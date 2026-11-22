/*****************************
 * app.config.js
 * Dynamic Expo config. The static base lives in app.json; this wrapper injects
 * secrets/keys from .env (EXPO_PUBLIC_*) at evaluation time so they are never
 * committed in app.json. Expo (SDK 49+) loads .env automatically before running
 * this file.
 ******************************/

const appJson = require('./app.json')

const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? ''

module.exports = () => {
  const { expo } = appJson

  return {
    ...expo,
    android: {
      ...expo.android,
      config: {
        ...expo.android?.config,
        googleMaps: {
          ...expo.android?.config?.googleMaps,
          apiKey: GOOGLE_MAPS_KEY
        }
      }
    },
    plugins: [
      // Injects the Android Maps key as com.google.android.geo.API_KEY. The
      // react-native-maps plugin only covers iOS; without this the Android map
      // renders blank. Listed FIRST so its manifest mod runs LAST (mod order is
      // the reverse of plugin order) and isn't overwritten by later mods.
      ['./plugins/withAndroidGoogleMapsApiKey', { apiKey: GOOGLE_MAPS_KEY }],
      'expo-image',
      'expo-splash-screen',
      ...(expo.plugins ?? []).map((plugin) =>
        Array.isArray(plugin) && plugin[0] === 'react-native-maps'
          ? ['react-native-maps', { iosGoogleMapsApiKey: GOOGLE_MAPS_KEY }]
          : plugin
      )
    ]
  }
}
