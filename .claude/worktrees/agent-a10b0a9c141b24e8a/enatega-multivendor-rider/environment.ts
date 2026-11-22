import { loadDevMessages, loadErrorMessages } from "@apollo/client/dev";

const requireEnv = (name: string, value?: string) => {
  if (!value) {
    throw new Error(`Missing ${name}. Add it to enatega-multivendor-rider/.env.`);
  }

  return value;
};

const getEnvVars = () => {
  if (__DEV__) {
    loadDevMessages();
    loadErrorMessages();
  }

  return {
    GRAPHQL_URL: requireEnv(
      "EXPO_PUBLIC_GRAPHQL_URL",
      process.env.EXPO_PUBLIC_GRAPHQL_URL
    ),
    WS_GRAPHQL_URL: requireEnv(
      "EXPO_PUBLIC_WS_GRAPHQL_URL",
      process.env.EXPO_PUBLIC_WS_GRAPHQL_URL
    ),
    SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,
    GOOGLE_MAPS_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY,
    ENVIRONMENT: __DEV__ ? "development" : "production",
  };
};

export default getEnvVars;
