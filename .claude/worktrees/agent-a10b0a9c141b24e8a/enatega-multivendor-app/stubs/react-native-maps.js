// Web replacement for react-native-maps on Expo Web preview.
//
// react-native-maps ships its own MapView.web.ts that just re-exports
// UnimplementedView, so on web every <MapView> silently rendered as an
// invisible empty box. This stub swaps in @teovilla/react-native-web-maps
// (a react-native-maps-compatible wrapper around @react-google-maps/api) so
// the map actually renders in the browser, while native (iOS/Android) keeps
// using the real react-native-maps library untouched — this file is only
// wired in for platform === 'web' by metro.config.js's resolveRequest
// override (webOnlyOverrides), never for native.
const React = require('react')
const WebMaps = require('@teovilla/react-native-web-maps')

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY

// Wrap the web MapView so callers that pass no key (or the same prop shape
// used on native) automatically get the web Google Maps JS API key without
// every screen needing to know about the web/native split.
const MapView = React.forwardRef(function MapView(props, ref) {
  return React.createElement(WebMaps.default, {
    ref,
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    ...props
  })
})
MapView.Animated = MapView

const Marker = WebMaps.Marker
const Polygon = WebMaps.Polygon
const Polyline = WebMaps.Polyline
const Circle = WebMaps.Circle
const Callout = WebMaps.Callout
const Geojson = WebMaps.Geojson

// Not implemented by @teovilla/react-native-web-maps — keep native-API-
// compatible no-ops so imports don't crash if a screen references them.
function CalloutSubview(props) { return React.createElement(React.Fragment, null, props.children) }
function Overlay() { return null }
function Heatmap() { return null }

// @teovilla/react-native-web-maps doesn't export provider constants (there is
// only one "provider" on web — Google Maps JS API). Native's PROVIDER_DEFAULT
// is null (let the OS pick Apple/Google Maps), but @teovilla's <MapView>
// renders nothing at all unless props.provider === 'google' exactly, so on
// web PROVIDER_DEFAULT must resolve to 'google' too, not null.
const PROVIDER_GOOGLE = 'google'
const PROVIDER_DEFAULT = 'google'

// __esModule: true ensures `import MapView from 'react-native-maps'` gets the function, not the object
module.exports = {
  __esModule: true,
  default: MapView,
  MapView,
  Marker,
  Polyline,
  Polygon,
  Circle,
  Callout,
  CalloutSubview,
  Overlay,
  Heatmap,
  Geojson,
  PROVIDER_GOOGLE,
  PROVIDER_DEFAULT,
  Animated: { MapView }
}
