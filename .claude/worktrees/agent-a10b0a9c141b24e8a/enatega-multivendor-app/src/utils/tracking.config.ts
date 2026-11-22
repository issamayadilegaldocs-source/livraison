// Centralized customer-side tracking freshness thresholds (§7/§9).
//
// These are intentionally kept >= the rider's foreground heartbeat
// (TRACKING_CONFIG.heartbeatIntervalMs = 30s in the rider app) so an online but
// stationary rider — who only re-sends on the heartbeat — never flaps to
// "unavailable". `staleAfterMs` mirrors the API's TRACKING_LOCATION_TTL /
// plan §9 "~90s" unavailable threshold. Freshness is judged on `receivedAt`.
export const CUSTOMER_TRACKING_CONFIG = {
  // Live → "updating" once a point is older than this (1.5× the rider heartbeat).
  updatingAfterMs: 45_000,
  // "updating" → "unavailable".
  staleAfterMs: 90_000,
  // Mirrors the rider app's foreground heartbeat cadence
  // (TRACKING_CONFIG.heartbeatIntervalMs = 30s). Used to pace the
  // between-heartbeat dead-reckoning animation so it finishes roughly when
  // the next fix is expected, instead of periodic 1.5s jumps.
  heartbeatIntervalMs: 30_000,
  // How far forward (seconds) we project the rider along their last
  // bearing/speed to make motion read as continuous between heartbeats.
  // Deliberately short relative to heartbeatIntervalMs so a real turn or
  // stop is never oversold.
  projectionSeconds: 15,
  // Hard cap on the forward projection distance regardless of reported
  // speed, so a bad/spiky speed reading can't send the marker far off-road.
  maxProjectionMeters: 180,
  // Fraction of the projected (dead-reckoned) point the marker eases toward
  // before smoothly correcting back onto the next authoritative fix.
  projectionOvershootRatio: 0.7,
  // Camera auto-follow: minimum time between automatic re-fits...
  autoFollowMinIntervalMs: 6_000,
  // ...or re-fit sooner if the rider has moved at least this far.
  autoFollowMinDistanceMeters: 60,
  // Route polyline refresh: re-request directions from the rider's current
  // position at most this often...
  routeRefreshMinIntervalMs: 30_000,
  // ...or sooner if the rider has drifted this far from the last computed
  // route origin (e.g. took a different street than expected).
  routeRefreshMinDistanceMeters: 250,
} as const;
