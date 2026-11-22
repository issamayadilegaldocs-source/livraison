import { ApolloClient } from "@apollo/client";
import * as Crypto from "expo-crypto";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import * as TaskManager from "expo-task-manager";
import { Client, createClient } from "graphql-ws";

import {
  CREATE_TRACKING_SESSION,
  CREATE_DISPATCH_PRESENCE_SESSION,
  UPDATE_ORDER_RIDER_LOCATION,
} from "@/lib/apollo/mutations/rider.mutation";
import {
  TRACKING_CONFIG,
  PRESENCE_SESSION_STORAGE_KEY,
  TRACKING_SESSION_STORAGE_KEY,
  TRACKING_TASK_NAME,
} from "./tracking.config";

interface TrackingSession {
  orderId: string;
  token: string;
  expiresAt: string;
}

interface PresenceSession {
  presenceToken: string;
  expiresAt: string;
}

interface LocationInput {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  headingDegrees?: number;
  speedMetersPerSecond?: number;
  capturedAt: string;
  updateId: string;
}

interface TrailPointInput {
  latitude: number;
  longitude: number;
  capturedAt: string;
}

const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

const mutation = `
  mutation UpdateOrderRiderLocation($orderId: ID!, $location: RiderLocationInput!, $bufferedPoints: [TrailPointInput!]) {
    updateOrderRiderLocation(orderId: $orderId, location: $location, bufferedPoints: $bufferedPoints) {
      orderId
      receivedAt
      updateId
    }
  }
`;

const presenceMutation = `
  mutation UpdateRiderDispatchPresenceByToken($location: RiderLocationInput!) {
    updateRiderDispatchPresenceByToken(location: $location)
  }
`;

let lastBackgroundPresenceAt = 0;

/**
 * Phase 4 — persistent foreground tracking transport.
 *
 * A dedicated graphql-ws socket, separate from the app's Clerk-authed Apollo
 * subscription socket. Tracking auth is the per-order `x-tracking-token`, and
 * graphql-ws sets auth once per connection via `connectionParams` (not per
 * message), so the socket is keyed by token and re-opened when the token (i.e.
 * the active order) changes. The server's `@TrackingToken()` decorator reads the
 * same token from `connectionParams`, so the resolver/service are unchanged.
 *
 * Foreground only — the background expo-task-manager path cannot hold a socket
 * and stays on HTTP. HTTP also remains the automatic fallback when the socket is
 * unavailable, so a publish is never dropped.
 */
const SOCKET_PUBLISH_TIMEOUT_MS = 4_000;

interface TrackingSocketState {
  token: string;
  client: Client;
}

let trackingSocket: TrackingSocketState | null = null;

// Surface a misconfigured/unreachable socket without spamming: if every publish
// is quietly using the HTTP fallback (e.g. WS URL set but unreachable), warn at
// most once per minute. Never logs the token or any coordinates (PII).
const SOCKET_WARN_INTERVAL_MS = 60_000;
let lastSocketWarnAt = 0;

const warnSocketFallback = () => {
  if (!__DEV__) return;
  const now = Date.now();
  if (now - lastSocketWarnAt < SOCKET_WARN_INTERVAL_MS) return;
  lastSocketWarnAt = now;
  console.warn(
    "[tracking] WebSocket publish unavailable; using HTTP fallback. " +
      "Check EXPO_PUBLIC_WS_GRAPHQL_URL reachability if this persists.",
  );
};

const ensureTrackingSocket = (token: string): Client => {
  if (trackingSocket?.token === token) return trackingSocket.client;
  if (trackingSocket) {
    try {
      trackingSocket.client.dispose();
    } catch {
      // Disposing a torn-down socket is best-effort.
    }
    trackingSocket = null;
  }
  const url = process.env.EXPO_PUBLIC_WS_GRAPHQL_URL;
  if (!url) throw new Error("Missing EXPO_PUBLIC_WS_GRAPHQL_URL");
  const client = createClient({
    url,
    lazy: false,
    retryAttempts: Infinity,
    retryWait: (retries) =>
      new Promise((resolve) =>
        setTimeout(resolve, Math.min(1000 * 2 ** retries, 30_000)),
      ),
    connectionParams: { "x-tracking-token": token },
  });
  trackingSocket = { token, client };
  return client;
};

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Tracking socket publish timed out")),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

const executeOverSocket = (
  client: Client,
  variables: Record<string, unknown>,
): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    let result: { errors?: Array<{ message: string }> } | undefined;
    client.subscribe(
      { query: mutation, variables },
      {
        next: (data) => {
          result = data as { errors?: Array<{ message: string }> };
        },
        error: reject,
        complete: () => {
          if (result?.errors?.length) reject(new Error(result.errors[0].message));
          else resolve();
        },
      },
    );
  });

const publishLocationOverSocket = (
  token: string,
  orderId: string,
  location: LocationInput,
  bufferedPoints: TrailPointInput[],
): Promise<void> => {
  const client = ensureTrackingSocket(token);
  return withTimeout(
    executeOverSocket(client, {
      orderId,
      location,
      ...(bufferedPoints.length ? { bufferedPoints } : {}),
    }),
    SOCKET_PUBLISH_TIMEOUT_MS,
  );
};

export const closeTrackingSocket = () => {
  if (!trackingSocket) return;
  try {
    trackingSocket.client.dispose();
  } catch {
    // Best-effort; the socket may already be closing.
  }
  trackingSocket = null;
};

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const withRetry = async <T>(operation: () => Promise<T>): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        const base = Math.min(
          500 * 2 ** attempt,
          TRACKING_CONFIG.retryMaximumMs,
        );
        await wait(base + Math.floor(Math.random() * 250));
      }
    }
  }
  throw lastError;
};

const toInput = (location: Location.LocationObject): LocationInput | null => {
  const { latitude, longitude, accuracy, heading, speed } = location.coords;
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180 ||
    (latitude === 0 && longitude === 0) ||
    (accuracy != null &&
      accuracy > TRACKING_CONFIG.maximumAcceptedAccuracyMeters)
  )
    return null;

  return {
    latitude,
    longitude,
    accuracyMeters: accuracy ?? undefined,
    headingDegrees: heading != null && heading >= 0 ? heading : undefined,
    speedMetersPerSecond: speed != null && speed >= 0 ? speed : undefined,
    capturedAt: new Date(location.timestamp).toISOString(),
    updateId: Crypto.randomUUID(),
  };
};

/**
 * Lighter mapping for buffered intermediate trail points (no accuracy gate — the
 * server already deduped/clamped the live point; these only enrich the route).
 * Drops obviously invalid coordinates so the batch never poisons the trail.
 */
const toTrailPoint = (
  location: Location.LocationObject,
): TrailPointInput | null => {
  const { latitude, longitude } = location.coords;
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180 ||
    (latitude === 0 && longitude === 0)
  )
    return null;
  return {
    latitude,
    longitude,
    capturedAt: new Date(location.timestamp).toISOString(),
  };
};

const toTrailPoints = (locations: Location.LocationObject[]): TrailPointInput[] =>
  locations
    .map(toTrailPoint)
    .filter((point): point is TrailPointInput => point !== null);

const getSession = async (): Promise<TrackingSession | null> => {
  const raw = await SecureStore.getItemAsync(
    TRACKING_SESSION_STORAGE_KEY,
    secureStoreOptions,
  );
  return raw ? (JSON.parse(raw) as TrackingSession) : null;
};

const getPresenceSession = async (): Promise<PresenceSession | null> => {
  const raw = await SecureStore.getItemAsync(
    PRESENCE_SESSION_STORAGE_KEY,
    secureStoreOptions,
  );
  return raw ? (JSON.parse(raw) as PresenceSession) : null;
};

const publishInBackground = async (
  session: TrackingSession,
  input: LocationInput,
  bufferedPoints: TrailPointInput[] = [],
) => {
  const endpoint = process.env.EXPO_PUBLIC_GRAPHQL_URL;
  if (!endpoint) return;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-tracking-token": session.token,
      "x-platform": "background-location",
    },
    body: JSON.stringify({
      query: mutation,
      variables: {
        orderId: session.orderId,
        location: input,
        ...(bufferedPoints.length ? { bufferedPoints } : {}),
      },
    }),
  });
  if (!response.ok) throw new Error("Tracking update failed");
  const body = (await response.json()) as {
    errors?: Array<{ message: string }>;
  };
  if (body.errors?.length) throw new Error(body.errors[0].message);
};

const publishPresenceInBackground = async (
  session: PresenceSession,
  input: LocationInput,
) => {
  const endpoint = process.env.EXPO_PUBLIC_GRAPHQL_URL;
  if (!endpoint) return;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-tracking-token": session.presenceToken,
      "x-platform": "background-location",
    },
    body: JSON.stringify({
      query: presenceMutation,
      variables: { location: input },
    }),
  });
  if (!response.ok) throw new Error("Dispatch presence update failed");
  const body = (await response.json()) as {
    errors?: Array<{ message: string }>;
  };
  if (body.errors?.length) throw new Error(body.errors[0].message);
};

if (!TaskManager.isTaskDefined(TRACKING_TASK_NAME)) {
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
    TRACKING_TASK_NAME,
    async ({ data, error }) => {
      if (error || !data?.locations?.length) return;
      const [session, presenceSession] = await Promise.all([
        getSession(),
        getPresenceSession(),
      ]);
      const latest = data.locations[data.locations.length - 1];
      const input = toInput(latest);
      if (!input) return;
      // Every intermediate point delivered in this batch (previously discarded)
      // is flushed as the route trail so connectivity gaps don't punch holes in it.
      const bufferedPoints = toTrailPoints(data.locations.slice(0, -1));
      const now = Date.now();
      const work: Promise<unknown>[] = [];
      if (session && Date.parse(session.expiresAt) > now) {
        work.push(
          withRetry(() => publishInBackground(session, input, bufferedPoints)),
        );
      }
      if (
        presenceSession &&
        Date.parse(presenceSession.expiresAt) > now &&
        now - lastBackgroundPresenceAt >= TRACKING_CONFIG.presenceIntervalMs
      ) {
        lastBackgroundPresenceAt = now;
        work.push(
          withRetry(() => publishPresenceInBackground(presenceSession, input)),
        );
      }
      await Promise.allSettled(work);
    },
  );
}

export const createTrackingSession = async (
  client: ApolloClient<object>,
  orderId: string,
): Promise<TrackingSession> => {
  const result = await client.mutate<{
    createTrackingSession: { token: string; expiresAt: string };
  }>({ mutation: CREATE_TRACKING_SESSION, variables: { orderId } });
  const created = result.data?.createTrackingSession;
  if (!created) throw new Error("Unable to create tracking session");
  const session = { orderId, ...created };
  await SecureStore.setItemAsync(
    TRACKING_SESSION_STORAGE_KEY,
    JSON.stringify(session),
    secureStoreOptions,
  );
  return session;
};

export const createPresenceSession = async (
  client: ApolloClient<object>,
): Promise<PresenceSession> => {
  const result = await client.mutate<{
    createDispatchPresenceSession: { token: string; expiresAt: string };
  }>({ mutation: CREATE_DISPATCH_PRESENCE_SESSION });
  const created = result.data?.createDispatchPresenceSession;
  if (!created) throw new Error("Unable to create dispatch presence session");
  const session = {
    presenceToken: created.token,
    expiresAt: created.expiresAt,
  };
  await SecureStore.setItemAsync(
    PRESENCE_SESSION_STORAGE_KEY,
    JSON.stringify(session),
    secureStoreOptions,
  );
  return session;
};

export const clearPresenceSession = () =>
  SecureStore.deleteItemAsync(PRESENCE_SESSION_STORAGE_KEY, secureStoreOptions);

export const clearTrackingSession = async () => {
  closeTrackingSocket();
  await SecureStore.deleteItemAsync(
    TRACKING_SESSION_STORAGE_KEY,
    secureStoreOptions,
  );
};

export const startBackgroundTracking = async (): Promise<boolean> => {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== "granted") return false;
  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== "granted") return false;
  if (await Location.hasStartedLocationUpdatesAsync(TRACKING_TASK_NAME))
    return true;

  await Location.startLocationUpdatesAsync(TRACKING_TASK_NAME, {
    accuracy: Location.Accuracy.BestForNavigation,
    distanceInterval: TRACKING_CONFIG.distanceIntervalMeters,
    timeInterval: TRACKING_CONFIG.minimumPublishIntervalMs,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Delivery tracking active",
      notificationBody:
        "Location is active for nearby orders or your current delivery.",
      notificationColor: "#F95509",
    },
  });
  return true;
};

export const publishForegroundLocation = async (
  client: ApolloClient<object>,
  session: TrackingSession,
  location: Location.LocationObject,
  bufferedLocations: Location.LocationObject[] = [],
) => {
  const input = toInput(location);
  if (!input) return;
  const bufferedPoints = toTrailPoints(bufferedLocations);
  // Phase 4: prefer the persistent tracking socket; on any socket failure fall
  // back to the HTTP mutation so a publish is never dropped. Re-sends carry the
  // same updateId, so the server's CAS dedup makes a double-send idempotent.
  try {
    await publishLocationOverSocket(
      session.token,
      session.orderId,
      input,
      bufferedPoints,
    );
    return;
  } catch {
    // Socket down / handshake failed / timed out — fall through to HTTP.
    warnSocketFallback();
  }
  await withRetry(() =>
    client.mutate({
      mutation: UPDATE_ORDER_RIDER_LOCATION,
      variables: {
        orderId: session.orderId,
        location: input,
        ...(bufferedPoints.length ? { bufferedPoints } : {}),
      },
      context: { headers: { "x-tracking-token": session.token } },
    }),
  );
};

export const stopTracking = async () => {
  closeTrackingSocket();
  if (await Location.hasStartedLocationUpdatesAsync(TRACKING_TASK_NAME)) {
    await Location.stopLocationUpdatesAsync(TRACKING_TASK_NAME);
  }
  await SecureStore.deleteItemAsync(
    TRACKING_SESSION_STORAGE_KEY,
    secureStoreOptions,
  );
};

export const stopBackgroundTracking = async () => {
  if (await Location.hasStartedLocationUpdatesAsync(TRACKING_TASK_NAME)) {
    await Location.stopLocationUpdatesAsync(TRACKING_TASK_NAME);
  }
};

export { getPresenceSession, getSession, publishPresenceInBackground, toInput };
