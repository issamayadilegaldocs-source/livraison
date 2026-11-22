/*****************************
 * withAndroidGoogleMapsApiKey
 * Injects the Google Maps API key into the Android manifest as
 * `com.google.android.geo.API_KEY`. The Maps SDK for Android renders a blank
 * map without this meta-data. Expo's react-native-maps plugin only injects the
 * iOS key (`iosGoogleMapsApiKey`), so the Android side is handled here and now
 * survives every `expo prebuild`.
 ******************************/

const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins')

const META_NAME = 'com.google.android.geo.API_KEY'

const withAndroidGoogleMapsApiKey = (config, { apiKey } = {}) => {
  return withAndroidManifest(config, (cfg) => {
    if (!apiKey) {
      console.warn(
        '[withAndroidGoogleMapsApiKey] No apiKey provided; skipping Android Maps key injection.'
      )
      return cfg
    }
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(
      cfg.modResults
    )
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      mainApplication,
      META_NAME,
      apiKey
    )
    return cfg
  })
}

module.exports = withAndroidGoogleMapsApiKey
