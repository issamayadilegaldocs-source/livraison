import { useApolloClient } from "@apollo/client";
import * as Location from "expo-location";
import { PropsWithChildren, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, StyleSheet, Text, View } from "react-native";

import { UPDATE_RIDER_DISPATCH_PRESENCE } from "@/lib/apollo/mutations/rider.mutation";
import { useLocationContext } from "./location.context";
import { useUserContext } from "./user.context";
import {
  clearPresenceSession,
  clearTrackingSession,
  createPresenceSession,
  createTrackingSession,
  getSession,
  publishForegroundLocation,
  startBackgroundTracking,
  stopBackgroundTracking,
  toInput,
} from "@/lib/services/rider-tracking.service";
import { TRACKING_CONFIG } from "@/lib/services/tracking.config";
import { haversineMeters } from "@/lib/utils/methods";
import { IOrder } from "@/lib/utils/interfaces/order.interface";

const ACTIVE_STATUSES = new Set(["ASSIGNED", "PICKED"]);

// Bound the intermediate-point ring buffer flushed alongside each live publish.
const TRAIL_BUFFER_MAX = 50;

/**
 * The point cadence tightens toward: the restaurant while heading to pick up
 * (ASSIGNED), the delivery address once carrying the order (PICKED). Coordinates
 * are GeoJSON [lng, lat]; both order shapes store them as arrays.
 */
const waypointFor = (
  order: IOrder | null | undefined,
): { latitude: number; longitude: number } | null => {
  if (!order) return null;
  const raw =
    order.orderStatus === "PICKED"
      ? order.deliveryAddress?.location?.coordinates
      : order.restaurant?.location?.coordinates;
  if (!raw || raw.length < 2) return null;
  const longitude = Number(raw[0]);
  const latitude = Number(raw[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
};

/**
 * Adaptive cadence (Phase 1): pick the publish interval from distance to the
 * active waypoint, then clamp to the floor while moving fast so a quick approach
 * never relaxes. Every tier stays well under the customer staleness cutoff.
 */
const resolvePublishInterval = (
  order: IOrder | null | undefined,
  latitude: number,
  longitude: number,
  speed: number | null,
): number => {
  const tiers = TRACKING_CONFIG.cadenceTiers;
  let interval: number = tiers[tiers.length - 1].intervalMs;
  const waypoint = waypointFor(order);
  if (waypoint) {
    const distance = haversineMeters(
      latitude,
      longitude,
      waypoint.latitude,
      waypoint.longitude,
    );
    if (distance != null) {
      for (const tier of tiers) {
        if (distance <= tier.withinMeters) {
          interval = tier.intervalMs;
          break;
        }
      }
    }
  }
  if (speed != null && speed >= TRACKING_CONFIG.fastMoveSpeedMps) {
    interval = Math.min(interval, TRACKING_CONFIG.minimumPublishIntervalMs);
  }
  return interval;
};

export const RiderTrackingProvider = ({ children }: PropsWithChildren) => {
  const client = useApolloClient();
  const { assignedOrders, dataProfile, userId } = useUserContext();
  const { coords } = useLocationContext();
  const lastPublishAt = useRef(0);
  const lastPresenceAt = useRef(0);
  const lastLocation = useRef<Location.LocationObject | null>(null);
  // Phase 2 — parked-tier state. `parkedRef` is read by both the movement effect
  // and the heartbeat so the cadence backs off consistently while stationary.
  const parkedRef = useRef(false);
  const stillSinceRef = useRef<number | null>(null);
  const stillAnchorRef = useRef<{
    latitude: number;
    longitude: number;
  } | null>(null);
  // Phase 3 — intermediate points captured between publishes, flushed in one batch.
  const trailBufferRef = useRef<Location.LocationObject[]>([]);
  const [backgroundEnabled, setBackgroundEnabled] = useState<boolean | null>(
    null,
  );

  const activeOrder = assignedOrders?.find((order) =>
    ACTIVE_STATUSES.has(order.orderStatus),
  );

  useEffect(() => {
    let cancelled = false;
    const synchronize = async () => {
      const existing = await getSession();
      if (!activeOrder || !userId) {
        if (existing) await clearTrackingSession();
        return;
      }
      if (
        existing?.orderId === activeOrder._id &&
        Date.parse(existing.expiresAt) > Date.now()
      ) {
        return;
      }
      if (existing) await clearTrackingSession();
      await createTrackingSession(client, activeOrder._id);
      if (cancelled) await clearTrackingSession();
    };
    synchronize().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeOrder?._id, client, userId]);

  useEffect(() => {
    let cancelled = false;
    const synchronizePresence = async () => {
      if (!dataProfile?.available || !userId) {
        await clearPresenceSession();
        return;
      }
      const session = await createPresenceSession(client);
      if (cancelled && session) await clearPresenceSession();
    };
    synchronizePresence().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [client, dataProfile?.available, userId]);

  useEffect(() => {
    let cancelled = false;
    const synchronizeBackgroundTask = async () => {
      if (!userId || (!dataProfile?.available && !activeOrder)) {
        await stopBackgroundTracking();
        if (!cancelled) setBackgroundEnabled(null);
        return;
      }
      const enabled = await startBackgroundTracking();
      if (cancelled) return;
      setBackgroundEnabled(enabled);
      if (!enabled) {
        AccessibilityInfo.announceForAccessibility(
          "Background location is disabled. Tracking continues only while the app is open.",
        );
      }
    };
    synchronizeBackgroundTask().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeOrder?._id, dataProfile?.available, userId]);

  useEffect(() => {
    if (!coords) return;
    const { latitude, longitude, accuracy, heading, speed, timestamp } = coords;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    // Phase 0 — carry the real accuracy/heading/speed through (was hardcoded null),
    // which is what the adaptive cadence and stationary detection below rely on.
    const locationObject = {
      coords: {
        latitude,
        longitude,
        accuracy,
        altitude: null,
        altitudeAccuracy: null,
        heading,
        speed,
      },
      timestamp,
    } satisfies Location.LocationObject;
    lastLocation.current = locationObject;

    const now = Date.now();

    // Phase 2 — stationary detection. "Still" means neither speed nor sustained
    // drift from the anchor indicates motion. Sustained stillness enters the
    // parked tier; any motion exits it immediately and forces a publish.
    const anchor = stillAnchorRef.current;
    const driftMeters = anchor
      ? haversineMeters(anchor.latitude, anchor.longitude, latitude, longitude)
      : null;
    const moving =
      (speed != null && speed >= TRACKING_CONFIG.stationarySpeedMps) ||
      (driftMeters != null &&
        driftMeters >= TRACKING_CONFIG.stationaryDriftMeters);

    let justResumed = false;
    if (moving) {
      stillSinceRef.current = null;
      stillAnchorRef.current = { latitude, longitude };
      if (parkedRef.current) {
        parkedRef.current = false;
        justResumed = true;
      }
    } else {
      if (stillSinceRef.current == null) {
        stillSinceRef.current = now;
        stillAnchorRef.current = { latitude, longitude };
      }
      if (
        !parkedRef.current &&
        now - stillSinceRef.current >= TRACKING_CONFIG.stationaryAfterMs
      ) {
        parkedRef.current = true;
      }
    }

    // Phase 1 — adaptive cadence (parked tier wins when stationary).
    const interval = parkedRef.current
      ? TRACKING_CONFIG.parkedIntervalMs
      : resolvePublishInterval(activeOrder, latitude, longitude, speed);

    if (activeOrder) {
      if (justResumed || now - lastPublishAt.current >= interval) {
        lastPublishAt.current = now;
        // Phase 3 — flush buffered intermediate points alongside the live point.
        const buffered = trailBufferRef.current;
        trailBufferRef.current = [];
        getSession()
          .then(
            (session) =>
              session &&
              publishForegroundLocation(
                client,
                session,
                locationObject,
                buffered,
              ),
          )
          .catch(() => {});
      } else {
        // Not publishing this sample yet — keep it for the next batch's trail.
        const buffer = trailBufferRef.current;
        buffer.push(locationObject);
        if (buffer.length > TRAIL_BUFFER_MAX) buffer.shift();
      }
    }

    if (
      dataProfile?.available &&
      now - lastPresenceAt.current >= TRACKING_CONFIG.presenceIntervalMs
    ) {
      const input = toInput(locationObject);
      if (!input) return;
      lastPresenceAt.current = now;
      client
        .mutate({
          mutation: UPDATE_RIDER_DISPATCH_PRESENCE,
          variables: { location: input },
        })
        .catch(() => {});
    }
  }, [
    activeOrder?._id,
    activeOrder?.orderStatus,
    client,
    coords,
    dataProfile?.available,
  ]);

  // Foreground heartbeat (§8): a stationary rider's `location` never changes, so
  // the effect above goes silent and the customer UI decays to "unavailable"
  // while the rider is online and idle. Re-publish the last known point on the
  // heartbeat interval, but only when no movement-driven publish already covered
  // this window, so movement and heartbeat never double-send.
  useEffect(() => {
    if (!activeOrder?._id) return;
    const interval = setInterval(() => {
      const now = Date.now();
      // While parked, the heartbeat backs off to the parked cadence so the slow
      // tier isn't defeated by the 30s heartbeat; otherwise the normal 30s applies.
      const threshold = parkedRef.current
        ? TRACKING_CONFIG.parkedIntervalMs
        : TRACKING_CONFIG.heartbeatIntervalMs;
      if (now - lastPublishAt.current < threshold) return;
      const last = lastLocation.current;
      if (!last) return;
      lastPublishAt.current = now;
      const buffered = trailBufferRef.current;
      trailBufferRef.current = [];
      getSession()
        .then(
          (session) =>
            session &&
            publishForegroundLocation(
              client,
              session,
              {
                ...last,
                timestamp: now,
              },
              buffered,
            ),
        )
        .catch(() => {});
    }, TRACKING_CONFIG.heartbeatIntervalMs);
    return () => clearInterval(interval);
  }, [activeOrder?._id, client]);

  // Dispatch heartbeat is independent of GPS movement. This fully covers a
  // stationary available rider while the app remains in the foreground.
  //
  // Platform caveat: iOS does NOT deliver background location updates for a
  // motionless device, so a stationary, backgrounded rider can still let their
  // presence go stale (server TTL ~5min, Mongo fallback ~10min). The reliable
  // "continuously dispatchable" guarantee therefore holds for foreground (this
  // heartbeat) and moving-background only. Closing the stationary-background
  // gap requires a connection-liveness model (e.g. WebSocket presence) and is
  // intentionally out of scope here.
  useEffect(() => {
    if (!dataProfile?.available) return;
    let cancelled = false;
    const publish = async () => {
      const now = Date.now();
      if (now - lastPresenceAt.current < TRACKING_CONFIG.presenceIntervalMs)
        return;
      const latest =
        lastLocation.current ?? (await Location.getLastKnownPositionAsync());
      if (cancelled || !latest) return;
      const input = toInput({ ...latest, timestamp: now });
      if (!input) return;
      lastLocation.current = latest;
      lastPresenceAt.current = now;
      await client.mutate({
        mutation: UPDATE_RIDER_DISPATCH_PRESENCE,
        variables: { location: input },
      });
    };
    publish().catch(() => {});
    const interval = setInterval(
      () => publish().catch(() => {}),
      TRACKING_CONFIG.presenceIntervalMs,
    );
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [client, dataProfile?.available]);

  return (
    <>
      {children}
      {(activeOrder || dataProfile?.available) &&
        backgroundEnabled === false && (
          <View accessibilityRole="alert" style={styles.warning}>
            <Text style={styles.warningText}>
              Background location is disabled. Keep the app open while you are
              available or on a delivery.
            </Text>
          </View>
        )}
    </>
  );
};

const styles = StyleSheet.create({
  warning: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 20,
    zIndex: 1000,
    borderRadius: 10,
    backgroundColor: "#7C2D12",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  warningText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
});
