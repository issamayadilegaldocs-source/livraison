// /*****************************
//  * environment.js
//  * path: '/environment.js' (root of your project)
//  ******************************/

import { useContext } from 'react'
import ConfigurationContext from './src/context/Configuration'
import * as Updates from 'expo-updates'

const useEnvVars = (env = Updates.channel) => {
  const configuration = useContext(ConfigurationContext)
  const clientConfig = {
    IOS_CLIENT_ID_GOOGLE: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    ANDROID_CLIENT_ID_GOOGLE: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    AMPLITUDE_API_KEY: process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY,
    GOOGLE_MAPS_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY,
    EXPO_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID,
    SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,
    GOOGLE_PACES_API_BASE_URL: process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_BASE_URL
  }

  const sharedConfig = {
    TERMS_AND_CONDITIONS: configuration?.termsAndConditions,
    PRIVACY_POLICY: configuration?.privacyPolicy,
    TEST_OTP: configuration?.testOtp,
    ...clientConfig
  }

  if (env === 'production' || env === 'staging') {
    return {
      GRAPHQL_URL:
        process.env.EXPO_PUBLIC_GRAPHQL_URL ||
        'https://aws-server-v2.enatega.com/graphql',
      WS_GRAPHQL_URL:
        process.env.EXPO_PUBLIC_WS_GRAPHQL_URL ||
        'wss://aws-server-v2.enatega.com/graphql',
      SERVER_URL:
        process.env.EXPO_PUBLIC_SERVER_URL ||
        'https://aws-server-v2.enatega.com/graphql',
      SERVER_REST_URL:
        process.env.EXPO_PUBLIC_SERVER_REST_URL ||
        'https://aws-server-v2.enatega.com/',
      ...sharedConfig
    }
  }

  return {
    GRAPHQL_URL:
      process.env.EXPO_PUBLIC_GRAPHQL_URL || 'http://localhost:4000/graphql',
    WS_GRAPHQL_URL:
      process.env.EXPO_PUBLIC_WS_GRAPHQL_URL || 'ws://localhost:4000/graphql',
    SERVER_URL:
      process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:4000/graphql',
    SERVER_REST_URL:
      process.env.EXPO_PUBLIC_SERVER_REST_URL || 'http://localhost:4000/',
    ...sharedConfig
  }
}

export default useEnvVars
