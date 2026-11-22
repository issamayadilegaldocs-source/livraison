import { Platform } from 'react-native';

type LatLng = { latitude: number; longitude: number };
type FitToCoordinatesOptions = {
  edgePadding?: { top: number; right: number; bottom: number; left: number };
  animated?: boolean;
};
type MapViewHandle = {
  fitToCoordinates?: (coordinates: LatLng[], options?: FitToCoordinatesOptions) => void;
};
type MapViewRefOrHandle = { current: MapViewHandle | null } | MapViewHandle | null;

declare const google: { maps?: { LatLngBounds?: unknown } } | undefined;

function resolveHandle(mapRefOrHandle: MapViewRefOrHandle): MapViewHandle | null {
  if (!mapRefOrHandle) return null;
  return 'current' in mapRefOrHandle ? mapRefOrHandle.current : mapRefOrHandle;
}

/**
 * @teovilla/react-native-web-maps' fitToCoordinates constructs a
 * `new google.maps.LatLngBounds()` internally. The Google Maps JS API loads
 * its sub-namespaces in stages, so `google.maps` can exist for a moment
 * before `LatLngBounds` is defined on it — calling fitToCoordinates in that
 * window throws "google.maps.LatLngBounds is not a constructor" and crashes
 * the map on web. Native react-native-maps has no such dependency, so this
 * only guards the web path, with one short retry for the still-loading case.
 */
export function safeFitToCoordinates(
  mapRefOrHandle: MapViewRefOrHandle,
  coordinates: LatLng[],
  options?: FitToCoordinatesOptions
): void {
  const call = () => resolveHandle(mapRefOrHandle)?.fitToCoordinates?.(coordinates, options);

  if (Platform.OS !== 'web') {
    call();
    return;
  }
  const mapsReady = typeof google !== 'undefined' && !!google?.maps?.LatLngBounds;
  if (mapsReady) {
    call();
    return;
  }
  setTimeout(() => {
    if (typeof google !== 'undefined' && google?.maps?.LatLngBounds) call();
  }, 300);
}
