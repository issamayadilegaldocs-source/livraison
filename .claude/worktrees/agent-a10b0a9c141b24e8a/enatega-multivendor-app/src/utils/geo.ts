// Small, dependency-free geo helpers used to smooth the live rider marker
// (dead-reckoning projection + bearing) and to keep the map camera framed on
// the rider + destination. Kept intentionally simple (planar/great-circle
// approximations) — plenty accurate at the sub-kilometre scale of a single
// delivery trip, no need for a full geodesy library.

export interface LatLng {
  latitude: number
  longitude: number
}

const EARTH_RADIUS_METERS = 6_371_000

const toRad = (deg: number) => (deg * Math.PI) / 180
const toDeg = (rad: number) => (rad * 180) / Math.PI

/** Initial bearing (degrees, 0-360, 0 = north) from `from` to `to`. */
export function bearingBetween(from: LatLng, to: LatLng): number {
  const lat1 = toRad(from.latitude)
  const lat2 = toRad(to.latitude)
  const dLon = toRad(to.longitude - from.longitude)
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

/** Great-circle destination point `distanceMeters` from `from` along `bearingDeg`. */
export function destinationPoint(
  from: LatLng,
  bearingDeg: number,
  distanceMeters: number
): LatLng {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return from
  const bearing = toRad(bearingDeg)
  const lat1 = toRad(from.latitude)
  const lon1 = toRad(from.longitude)
  const angularDistance = distanceMeters / EARTH_RADIUS_METERS

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing)
  )
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
    )

  return { latitude: toDeg(lat2), longitude: toDeg(lon2) }
}

/** Haversine distance in meters between two points. */
export function haversineDistanceMeters(a: LatLng, b: LatLng): number {
  const lat1 = toRad(a.latitude)
  const lat2 = toRad(b.latitude)
  const dLat = toRad(b.latitude - a.latitude)
  const dLon = toRad(b.longitude - a.longitude)
  const sinDLat = Math.sin(dLat / 2)
  const sinDLon = Math.sin(dLon / 2)
  const h =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(Math.min(1, h)))
}

/**
 * Given a current heading and a target heading (both 0-360), returns a
 * target value that is a *continuation* of `currentDeg` along the shortest
 * angular path — e.g. shortestAngleTarget(350, 10) => 370, not 10 — so an
 * animation driver (withTiming) rotates the marker the short way round
 * instead of spinning almost a full turn at the 0/360 wraparound.
 */
export function shortestAngleTarget(currentDeg: number, targetDeg: number): number {
  const delta = ((((targetDeg - currentDeg) % 360) + 540) % 360) - 180
  return currentDeg + delta
}
