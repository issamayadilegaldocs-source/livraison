// Native (iOS/Android) map implementation.
//
// Metro automatically prefers `MapView.web.tsx` for web bundles and falls
// back to this file for native platforms, so this file must stay a thin
// pass-through to the real react-native-maps library.
export {
  default,
  Marker,
  Polygon,
  Polyline,
  PROVIDER_DEFAULT,
  PROVIDER_GOOGLE
} from "react-native-maps";
