// Providers
import { SoundProvider } from "@/lib/context/global/sound.context";
import { UserProvider } from "@/lib/context/global/user.context";

// Theme
import { useApptheme } from "@/lib/context/theme.context";

// Expo
import { Stack } from "expo-router";

export default function UnProtectedLayout() {
  const { appTheme, currentTheme } = useApptheme();

  // Secondary auth screens get a native header with a back button so the
  // user can return to the previous step; the login root stays headerless.
  const secondaryScreenOptions = {
    headerShown: true,
    gestureEnabled: true,
    headerTitle: "",
    headerShadowVisible: false,
    headerStyle: { backgroundColor: appTheme.themeBackground },
    headerTintColor: currentTheme === "dark" ? "#fff" : "#000",
  } as const;

  return (
    <UserProvider>
      <SoundProvider>
        <>
          <Stack
            screenOptions={{
              headerShown: false,
              gestureEnabled: false,
            }}
          >
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="register" options={secondaryScreenOptions} />
            <Stack.Screen name="email-otp" options={secondaryScreenOptions} />
            <Stack.Screen
              name="forgot-password"
              options={secondaryScreenOptions}
            />
            <Stack.Screen
              name="forgot-password-otp"
              options={secondaryScreenOptions}
            />
            <Stack.Screen
              name="set-password"
              options={secondaryScreenOptions}
            />
          </Stack>
        </>
      </SoundProvider>
    </UserProvider>
  );
}
