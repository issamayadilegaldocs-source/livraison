/* eslint-disable @typescript-eslint/no-require-imports */
import { ClerkProvider } from "@clerk/clerk-expo";
import * as Sentry from "@sentry/react-native";
import { useFonts } from "expo-font";
import { requestMediaLibraryPermissionsAsync } from "expo-image-picker";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { I18nManager, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Updates from "expo-updates";

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
import FlashMessage from "react-native-flash-message";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import "react-native-reanimated";

import "../global.css";
import "@/i18next";

import setupApollo from "@/lib/apollo";
import { AuthProvider } from "@/lib/context/global/auth.context";
import { useApptheme } from "@/lib/context/global/theme.context";
import { ConfigurationProvider } from "@/lib/context/global/configuration.context";
import InternetProvider from "@/lib/context/global/internet-provider";
import { LocationProvider } from "@/lib/context/global/location.context";
import { SoundProvider } from "@/lib/context/global/sound.context";
import AppThemeProvidor from "@/lib/context/global/theme.context";
import { UserProvider } from "@/lib/context/global/user.context";
import { RiderTrackingProvider } from "@/lib/context/global/rider-tracking.provider";
import RootStackLayout from "@/lib/ui/layouts/root-layout";
import { LocationPermissionComp } from "@/lib/ui/useable-components";
import AnimatedSplashScreen from "@/lib/ui/useable-components/splash/AnimatedSplashScreen";
import UnavailableStatus from "@/lib/ui/useable-components/unavailable-status";
import IncomingOrderModal from "@/lib/ui/useable-components/incoming-order-modal";
import { initSentry } from "@/lib/utils/service";
import { tokenCache } from "@/lib/utils/clerkTokenCache";
import { ApolloProvider } from "@apollo/client";

initSentry();
SplashScreen?.preventAutoHideAsync();

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error(
    "Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY. Copy .env.example to .env and set the value."
  );
}

// Status bar content (clock, battery, signal) must contrast with the app
// background: dark icons on the light theme, light icons on the dark theme.
function ThemedStatusBar() {
  const { currentTheme } = useApptheme();
  return <StatusBar style={currentTheme === "dark" ? "light" : "dark"} />;
}

function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require("../lib/assets/fonts/SpaceMono-Regular.ttf"),
    Inter: require("../lib/assets/fonts/Inter.ttf"),
  });
  const client = setupApollo();

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.log("Global Error Caught:", { error, isFatal });
  });

  useEffect(() => {
    requestMediaLibraryPermissionsAsync();
  }, []);

  useEffect(() => {
    // Android high-importance channel for incoming order calls
    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("incoming_call", {
        name: "Incoming Orders",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        sound: "default",
        enableVibrate: true,
        showBadge: true,
      });
    }
    // When app is in foreground, suppress the banner for INCOMING_ORDER — the modal handles it
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const type = notification.request.content.data?.type;
        if (type === "INCOMING_ORDER") {
          return {
            shouldShowAlert: false,
            shouldShowBanner: false,
            shouldShowList: false,
            shouldPlaySound: false,
            shouldSetBadge: false,
          };
        }
        return {
          shouldShowAlert: true,
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        };
      },
    });
  }, []);

  if (!loaded) return null;

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <AnimatedSplashScreen>
        <AppThemeProvidor>
        <ApolloProvider client={client}>
          <AuthProvider>
            <UserProvider>
              <InternetProvider>
                <ConfigurationProvider>
                  <LocationProvider>
                    <RiderTrackingProvider>
                      <SoundProvider>
                        <LocationPermissionComp>
                          <RootStackLayout />
                          <UnavailableStatus />
                          <IncomingOrderModal />
                        </LocationPermissionComp>
                        <ThemedStatusBar />
                        <FlashMessage position="bottom" />
                      </SoundProvider>
                    </RiderTrackingProvider>
                  </LocationProvider>
                </ConfigurationProvider>
              </InternetProvider>
            </UserProvider>
          </AuthProvider>
        </ApolloProvider>
        </AppThemeProvidor>
      </AnimatedSplashScreen>
    </SafeAreaProvider>
  );
}

function App() {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
      <RootLayout />
    </ClerkProvider>
  );
}

export default Sentry.wrap(App);
