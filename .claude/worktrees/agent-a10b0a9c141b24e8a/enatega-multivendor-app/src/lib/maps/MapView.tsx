// Native (iOS/Android) map implementation.
//
// Metro automatically prefers `MapView.web.tsx` for web bundles and falls
// back to this file for native platforms, so this file must stay a thin
// pass-through to the real react-native-maps library — the actual
// react-native-maps -> web stub swap used to live in metro.config.js; that
// mechanism is superseded by this wrapper module for all screens that import
// it, but metro.config.js's web-only override is left in place as a
// belt-and-braces fallback for any remaining direct `react-native-maps`
// imports.
export {
  default,
  Marker,
  Polygon,
  Polyline,
  PROVIDER_DEFAULT,
  PROVIDER_GOOGLE
} from 'react-native-maps'
