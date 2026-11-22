/*****************************
 * environment.js
 * path: '/environment.js' (root of your project)
 ******************************/

import * as Updates from "expo-updates";

const getEnvVars = (env = Updates.channel) => {
  if (env === "production" || env === "staging") {
    return {
      GRAPHQL_URL:
        process.env.EXPO_PUBLIC_GRAPHQL_URL ||
        "https://aws-server-v2.enatega.com/graphql",
      WS_GRAPHQL_URL:
        process.env.EXPO_PUBLIC_WS_GRAPHQL_URL ||
        "wss://aws-server-v2.enatega.com/graphql",
      SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,

    };
  }
  return {
      GRAPHQL_URL:
        process.env.EXPO_PUBLIC_GRAPHQL_URL || "http://localhost:4000/graphql",
      WS_GRAPHQL_URL:
        process.env.EXPO_PUBLIC_WS_GRAPHQL_URL || "ws://localhost:4000/graphql",
      SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,
  };
};

export default getEnvVars;
