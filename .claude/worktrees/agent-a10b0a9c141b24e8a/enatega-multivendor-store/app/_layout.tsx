/* eslint-disable @typescript-eslint/no-require-imports */
import * as SplashScreen from "expo-splash-screen";
import "react-native-reanimated";

// Clerk
import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { tokenCache } from "@/lib/utils/clerkTokenCache";

// Service
import setupApollo from "@/lib/apollo";
import PublicAccessTokenService from "@/lib/services/public-access-token.service";

// Providers
import { AuthProvider } from "@/lib/context/global/auth.context";
import { ConfigurationProvider } from "@/lib/context/global/configuration.context";
import { ApolloProvider } from "@apollo/client";

import { useEffect, useState } from "react";
import { I18nManager, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Updates from "expo-updates";

// Locale
import "@/i18next";

const RTL_LANGS = ["ar", "fa", "ur", "he", "ps", "ku"];

async function applyRTL() {
  try {
    const stored = await AsyncStorage.getItem("enatega-language");
    const shouldBeRTL = RTL_LANGS.includes(stored ?? "");
    if (I18nManager.isRTL !== shouldBeRTL) {
      I18nManager.forceRTL(shouldBeRTL);
      if (!__DEV__) await Updates.reloadAsync();
    }
  } catch {
    // ignore on first run
  }
}
applyRTL();

// Style
import "../global.css";

// Hooks
import { UserProvider } from "@/lib/context/global/user.context";
import { useFonts } from "expo-font";
import { useKeepAwake } from "expo-keep-awake";
import { StatusBar } from "expo-status-bar";
import FlashMessage from "react-native-flash-message";

// Providers
import InternetProvider from "@/lib/context/global/internet-provider";
// UI
import AppThemeProvidor, { useApptheme } from "@/lib/context/theme.context";
import AnimatedSplashScreen from "@/lib/ui/useable-components/splash/AnimatedSplashScreen";
import UnavailableStatus from "@/lib/ui/useable-components/unavailable-status";

import { Slot } from "expo-router";

SplashScreen.preventAutoHideAsync();

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

if (__DEV__ && !CLERK_PUBLISHABLE_KEY) {
  console.error("EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not set — Clerk will not work");
}
if (!__DEV__ && !CLERK_PUBLISHABLE_KEY) {
  throw new Error("Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY");
}

function AppProviders() {
  const { getToken } = useAuth();
  const { currentTheme, appTheme } = useApptheme();
  const [loaded] = useFonts({
    SpaceMono: require("../lib/assets/fonts/SpaceMono-Regular.ttf"),
    Inter: require("../lib/assets/fonts/Inter.ttf"),
  });

  const [isTokenReady, setIsTokenReady] = useState(false);
  const [client] = useState(() => setupApollo(getToken));

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  useEffect(() => {
    // 6-second hard cap so a slow/unreachable API never blocks the UI indefinitely
    const fallback = setTimeout(() => setIsTokenReady(true), 6000);
    PublicAccessTokenService.initialize(client)
      .then(() => setIsTokenReady(true))
      .catch(() => setIsTokenReady(true))
      .finally(() => clearTimeout(fallback));
  }, [client]);

  if (!isTokenReady) {
    return null;
  }

  return (
    <ApolloProvider client={client}>
      <AnimatedSplashScreen>
        <InternetProvider>
          <ConfigurationProvider>
            <AuthProvider>
              <StatusBar
                style={currentTheme ?? "dark"}
                backgroundColor={appTheme.themeBackground ?? ""}
              />
              <UserProvider>
                <View style={{ flex: 1 }}>
                  <UnavailableStatus />
                  <Slot />
                </View>
              </UserProvider>
            </AuthProvider>
          </ConfigurationProvider>
        </InternetProvider>
      </AnimatedSplashScreen>
      <FlashMessage position="center" />
    </ApolloProvider>
  );
}

function RootLayout() {
  useKeepAwake();

  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      tokenCache={tokenCache}
    >
      <AppThemeProvidor>
        <AppProviders />
      </AppThemeProvidor>
    </ClerkProvider>
  );
}

export default RootLayout;
