const { getDefaultConfig } = require('@expo/metro-config')
const path = require('path')
const defaultConfig = getDefaultConfig(__dirname)
defaultConfig.resolver.sourceExts.push('cjs')

// Packages that Metro cannot resolve from within node_modules, or are native-only
const moduleOverrides = {
  // axios exposes a Node CJS main that imports crypto/http; React Native needs
  // the browser build so Metro does not pull Node standard-library modules.
  axios: path.resolve(__dirname, 'node_modules/axios/dist/browser/axios.cjs'),
  // react-native-country-picker-modal peer dep — Metro can't traverse up from node_modules
  'react-async-hook': path.resolve(__dirname, 'node_modules/react-async-hook/dist/index.js'),
  // lottie-react-native web dep — ESM-only package, not parseable by Metro
  '@lottiefiles/dotlottie-react': path.resolve(__dirname, 'stubs/dotlottie-react.js'),
  // calls new NativeEventEmitter at module load time — crashes on web
  '@microsoft/react-native-clarity': path.resolve(__dirname, 'stubs/react-native-clarity.js'),
  // useLastNotificationResponse calls native method — unavailable on web
  'expo-notifications': path.resolve(__dirname, 'stubs/expo-notifications.js'),
}

// Stubs that must ONLY apply when bundling for web. react-native-maps is a
// native module with no web implementation, so it is stubbed for web — but on
// android/ios the REAL library must be used or the map renders blank (an empty
// stub View). Previously this lived in moduleOverrides and was applied to every
// platform, which silently broke all native maps.
const webOnlyOverrides = {
  'react-native-maps': path.resolve(__dirname, 'stubs/react-native-maps.js'),
}

const originalResolveRequest = defaultConfig.resolver.resolveRequest
defaultConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && webOnlyOverrides[moduleName]) {
    return { filePath: webOnlyOverrides[moduleName], type: 'sourceFile' }
  }
  if (moduleOverrides[moduleName]) {
    return { filePath: moduleOverrides[moduleName], type: 'sourceFile' }
  }
  // All @react-native-vector-icons/* sub-packages → single stub
  if (moduleName.startsWith('@react-native-vector-icons/')) {
    return { filePath: path.resolve(__dirname, 'stubs/@react-native-vector-icons/index.js'), type: 'sourceFile' }
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform)
  }
  return context.resolveRequest(context, moduleName, platform)
}
module.exports = defaultConfig
