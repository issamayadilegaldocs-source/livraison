// Web map implementation, used automatically by Metro for web bundles
// (Metro resolves `./MapView` to `MapView.web.tsx` when platform === 'web').
//
// react-native-maps ships its own MapView.web.ts that just re-exports
// UnimplementedView, so on web every <MapView> silently rendered as an
// invisible empty box. @teovilla/react-native-web-maps wraps
// @react-google-maps/api behind a react-native-maps-compatible API, so we
// use it here instead.
//
// Note: @teovilla/react-native-web-maps's <MapView> renders nothing at all
// unless props.provider === "google" exactly (it warns and returns null
// otherwise), so PROVIDER_DEFAULT must resolve to "google" here too, not
// react-native-maps's native "default" value — otherwise screens that do
// `Platform.OS === "android" ? PROVIDER_GOOGLE : PROVIDER_DEFAULT` get a
// blank map on web (e.g. iOS/web falls through PROVIDER_DEFAULT).
import React, { forwardRef } from "react";
import WebMapView, {
  Marker as WebMarker,
  Polygon as WebPolygon,
  Polyline as WebPolyline,
} from "@teovilla/react-native-web-maps";

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY;

const MapView = forwardRef<any, any>((props, ref) => (
  <WebMapView ref={ref} googleMapsApiKey={GOOGLE_MAPS_API_KEY} {...props} />
));

export default MapView;
export const Marker = WebMarker;
export const Polygon = WebPolygon;
export const Polyline = WebPolyline;
export const PROVIDER_GOOGLE = "google";
export const PROVIDER_DEFAULT = "google";
