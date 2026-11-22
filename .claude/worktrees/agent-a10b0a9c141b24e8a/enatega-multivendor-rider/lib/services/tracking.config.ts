export const TRACKING_TASK_NAME = "RIDER_ORDER_TRACKING";
export const TRACKING_SESSION_STORAGE_KEY = "rider_order_tracking_session";
export const PRESENCE_SESSION_STORAGE_KEY = "rider_dispatch_presence";

export const TRACKING_CONFIG = {
  distanceIntervalMeters: 10,
  // Floor for any movement-driven publish (also the background task's timeInterval).
  minimumPublishIntervalMs: 5_000,
  heartbeatIntervalMs: 30_000,
  presenceIntervalMs: 60_000,
  maximumAcceptedAccuracyMeters: 250,
  retryMaximumMs: 30_000,

  // Phase 1 — adaptive cadence. Publish faster the closer the rider is to the
  // active waypoint (restaurant when ASSIGNED, delivery address when PICKED).
  // Tiers are evaluated nearest-first; the first whose `withinMeters` covers the
  // distance wins. Every tier stays well under the customer staleness cutoff
  // (server locationTtlSeconds = 600s) so the customer map never flaps.
  cadenceTiers: [
    { withinMeters: 800, intervalMs: 3_000 }, // last mile
    { withinMeters: 3_000, intervalMs: 5_000 }, // approach
    { withinMeters: Number.POSITIVE_INFINITY, intervalMs: 12_000 }, // far / en route
  ] as const,
  // ~29 km/h: while moving this fast, never relax cadence below `minimumPublishIntervalMs`
  // regardless of distance, so a fast approach stays high-fidelity.
  fastMoveSpeedMps: 8,

  // Phase 2 — parked tier. A stationary rider backs off to a slow cadence and
  // snaps back to movement cadence the moment they move again.
  stationarySpeedMps: 0.5, // below this (and below drift threshold) = candidate parked
  stationaryDriftMeters: 15, // sustained position drift under this also counts as still
  stationaryAfterMs: 90_000, // sustained-still window before entering the parked tier
  parkedIntervalMs: 90_000, // publish cadence while parked (< 600s customer staleness)
} as const;
