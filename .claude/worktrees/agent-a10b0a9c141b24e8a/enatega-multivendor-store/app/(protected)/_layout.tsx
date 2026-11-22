// Providers
import RestaurantProvider from "@/lib/context/global/restaurant";
import { SoundProvider } from "@/lib/context/global/sound.context";
import { useApptheme } from "@/lib/context/theme.context";

// Clerk
import { useAuth, useClerk } from "@clerk/clerk-expo";

// Expo
import * as SecureStore from "@/lib/utils/safeSecureStore";
import { Href, router, Stack } from "expo-router";
import { StatusBar, StatusBarStyle } from "expo-status-bar";
import { useCallback, useEffect } from "react";

// React Native Flash Message
import FlashMessage from "react-native-flash-message";

import { ROUTES } from "@/lib/utils/constants";
import { useStoreSession } from "@/lib/hooks/useStoreSession";
import { FlashMessageComponent } from "@/lib/ui/useable-components";

export default function ProtectedLayout() {
  const { appTheme, currentTheme } = useApptheme();
  const { isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const { finalizeSession } = useStoreSession();

  const guardAuth = useCallback(async () => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace(ROUTES.login as Href);
      return;
    }
    const id = await SecureStore.getItemAsync("store-id");
    if (!id) {
      // Signed in but store-id is missing (e.g. Android OAuth restarted the
      // activity before finalizeSession ran). Recover by re-deriving the store
      // from the active session rather than nuking it; only log out if the
      // account genuinely has no linked restaurant.
      try {
        await finalizeSession();
      } catch (error: unknown) {
        // Surface why, or a failed profile lookup looks like an unexplained
        // redirect loop back to login.
        const message = error instanceof Error ? error.message : undefined;
        if (message) FlashMessageComponent({ message });
        await signOut();
        router.replace(ROUTES.login as Href);
      }
    }
  }, [isLoaded, isSignedIn, signOut, finalizeSession]);

  useEffect(() => {
    guardAuth();
  }, [guardAuth]);

  return (
    <RestaurantProvider.Provider>
      <SoundProvider>
        <>
          <Stack
            screenOptions={{
              headerShown: false,
              headerStyle: {
                backgroundColor: appTheme.screenBackground,
              },
              headerTitleAlign: "center",
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="order-detail"
              options={{ headerShown: false }}
            />
            <Stack.Screen name="chat" options={{ headerShown: false }} />
          </Stack>
          {/* <Stack.Screen
            name="bank-management"
            options={{ headerShown: true }}
          /> */}
          <StatusBar style={currentTheme as StatusBarStyle} />
          <FlashMessage position="bottom" />
        </>
      </SoundProvider>
    </RestaurantProvider.Provider>
  );
}
