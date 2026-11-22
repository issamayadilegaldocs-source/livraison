/**
 * Great-circle distance in kilometres between two WGS84 points (Haversine
 * formula, R = 6371 km). Single source of truth for every straight-line
 * distance calculation in the API — delivery-fee pricing, tracking's arrival
 * geofence, and the Fleet & Dispatch operations center (zone stats, dispatch
 * hotspots, smart-dispatch scoring) all import this instead of maintaining
 * their own copy.
 *
 * Returns 0 for any non-finite input so a malformed coordinate (bad address,
 * missing GPS fix) can never produce a NaN downstream.
 */
export function haversineKm(
  latStart: number,
  lonStart: number,
  latDest: number,
  lonDest: number,
): number {
  if (
    ![latStart, lonStart, latDest, lonDest].every(
      (v) => typeof v === 'number' && Number.isFinite(v),
    )
  ) {
    return 0;
  }
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(latDest - latStart);
  const dLon = toRad(lonDest - lonStart);
  const lat1 = toRad(latStart);
  const lat2 = toRad(latDest);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
