// Web replacement for react-native-maps on Expo Web preview.
//
// react-native-maps ships its own MapView.web.ts that just re-exports
// UnimplementedView, so on web every <MapView> silently rendered as an
// invisible empty box. This stub swaps in @teovilla/react-native-web-maps
// (a react-native-maps-compatible wrapper around @react-google-maps/api) so
// the map actually renders in the browser, while native (iOS/Android) keeps
// using the real react-native-maps library untouched — this file is only
// wired in for platform === 'web' by metro.config.js's resolveRequest
// override (webModuleOverrides), never for native.
const React = require("react");
const WebMaps = require("@teovilla/react-native-web-maps");

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY;

// Wrap the web MapView so callers that pass no key (or the same prop shape
// used on native) automatically get the web Google Maps JS API key without
// every screen needing to know about the web/native split.
const MapView = React.forwardRef(function MapView(props, ref) {
  return React.createElement(WebMaps.default, {
    ref,
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    ...props,
  });
});
MapView.Animated = MapView;

const Marker = WebMaps.Marker;
Marker.Animated = Marker;
const Polygon = WebMaps.Polygon;
const Polyline = WebMaps.Polyline;
const Circle = WebMaps.Circle;
const Callout = WebMaps.Callout;
const Geojson = WebMaps.Geojson;

// @teovilla/react-native-web-maps's <MapView> renders nothing at all unless
// props.provider === "google" exactly (it warns and returns null otherwise),
// so on web PROVIDER_DEFAULT must resolve to "google" too, not "default" —
// screens that do `Platform.OS === "android" ? PROVIDER_GOOGLE : PROVIDER_DEFAULT`
// otherwise get a blank map on web.
const PROVIDER_GOOGLE = "google";
const PROVIDER_DEFAULT = "google";

module.exports = {
  __esModule: true,
  default: MapView,
  MapView,
  Marker,
  Polyline,
  Polygon,
  Circle,
  Callout,
  Geojson,
  PROVIDER_GOOGLE,
  PROVIDER_DEFAULT,
  Animated: { MapView },
};
