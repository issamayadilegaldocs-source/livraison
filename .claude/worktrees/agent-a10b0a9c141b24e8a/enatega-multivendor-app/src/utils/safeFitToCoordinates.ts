import { Platform } from 'react-native'

type LatLng = { latitude: number; longitude: number }
type FitToCoordinatesOptions = {
  edgePadding?: { top: number; right: number; bottom: number; left: number }
  animated?: boolean
}
type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }
type MapViewHandle = {
  fitToCoordinates?: (coordinates: LatLng[], options?: FitToCoordinatesOptions) => void
  animateToRegion?: (region: Region, duration?: number) => void
}
type MapViewRefOrHandle = { current: MapViewHandle | null } | MapViewHandle | null

declare const google: { maps?: { LatLngBounds?: unknown } } | undefined

function resolveHandle(mapRefOrHandle: MapViewRefOrHandle): MapViewHandle | null {
  if (!mapRefOrHandle) return null
  return 'current' in mapRefOrHandle ? mapRefOrHandle.current : mapRefOrHandle
}

function mapsReady(): boolean {
  return typeof google !== 'undefined' && !!google?.maps?.LatLngBounds
}

/**
 * Runs `run` once the Google Maps JS API's `LatLngBounds` sub-namespace is
 * available (native is unaffected and runs immediately), retrying once after
 * a short delay if it isn't ready yet, then giving up silently.
 */
function runWhenMapsReady(run: () => void): void {
  if (Platform.OS !== 'web' || mapsReady()) {
    run()
    return
  }
  setTimeout(() => {
    if (mapsReady()) run()
  }, 300)
}

/**
 * @teovilla/react-native-web-maps' fitToCoordinates constructs a
 * `new google.maps.LatLngBounds()` internally. The Google Maps JS API loads
 * its sub-namespaces in stages, so `google.maps` can exist for a moment
 * before `LatLngBounds` is defined on it — calling fitToCoordinates in that
 * window throws "google.maps.LatLngBounds is not a constructor" and crashes
 * the map on web. Native react-native-maps has no such dependency, so this
 * only guards the web path, with one short retry for the still-loading case.
 *
 * Accepts either a React ref (`{ current }`) or an already-resolved map
 * instance, since existing call sites use both patterns.
 */
export function safeFitToCoordinates(
  mapRefOrHandle: MapViewRefOrHandle,
  coordinates: LatLng[],
  options?: FitToCoordinatesOptions
): void {
  runWhenMapsReady(() => resolveHandle(mapRefOrHandle)?.fitToCoordinates?.(coordinates, options))
}

/**
 * Same "google.maps.LatLngBounds is not a constructor" hazard as
 * {@link safeFitToCoordinates}, but for `animateToRegion` — @teovilla/react-native-web-maps'
 * implementation also constructs a `LatLngBounds` internally.
 */
export function safeAnimateToRegion(
  mapRefOrHandle: MapViewRefOrHandle,
  region: Region,
  duration?: number
): void {
  runWhenMapsReady(() => resolveHandle(mapRefOrHandle)?.animateToRegion?.(region, duration))
}
