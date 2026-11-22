import { useAuth, useOAuth, useSignIn } from "@clerk/clerk-expo";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { Href, router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FontAwesome } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useApptheme } from "@/lib/context/global/theme.context";
import { ROUTES } from "@/lib/utils/constants";
import { FlashMessageComponent } from "../../useable-components";

WebBrowser.maybeCompleteAuthSession();

const LoginScreen = () => {
  const { appTheme } = useApptheme();
  const { t } = useTranslation();
  const { startOAuthFlow: startGoogleFlow } = useOAuth({ strategy: "oauth_google" });
  const { startOAuthFlow: startAppleFlow } = useOAuth({ strategy: "oauth_apple" });
  const { signIn, setActive, isLoaded } = useSignIn();
  const { isSignedIn } = useAuth();

  // A Clerk session may already be active (persisted in the token cache) while
  // this screen is still mounted. Clerk runs in single-session mode, so starting
  // a new sign-in/OAuth flow here throws "session already exists". Redirect to
  // home instead of letting the user trigger that error.
  useEffect(() => {
    if (isSignedIn) router.replace(ROUTES.home as Href);
  }, [isSignedIn]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hidePassword, setHidePassword] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const extractClerkError = (err: unknown): string => {
    // Clerk error objects have non-enumerable props — JSON.stringify returns {}
    const e = err as { errors?: { longMessage?: string; message?: string; code?: string }[]; message?: string };
    if (e?.errors?.length) {
      return e.errors.map(x => x.longMessage ?? x.message ?? x.code ?? "Unknown").join(", ");
    }
    if (e?.message) return e.message;
    if (err instanceof Error) return err.message;
    return t("somethingWentWrong");
  };

  // Clerk runs in single-session mode: signIn.create / startOAuthFlow throw
  // "session_exists" when a persisted session is already active. `isSignedIn`
  // can lag behind Clerk's real state at submit time, so the guards above
  // don't always catch it. An existing session means the user IS logged in —
  // go home instead of surfacing a blocking error on the login form.
  const isSessionExists = (err: unknown): boolean => {
    const e = err as { errors?: { code?: string }[] };
    return e?.errors?.some((x) => x.code === "session_exists") ?? false;
  };

  const showError = (err: unknown) => {
    FlashMessageComponent({ message: extractClerkError(err) });
  };

  const handlePasswordSignIn = async () => {
    console.log("[Login] handlePasswordSignIn called — isLoaded:", isLoaded, "submitting:", submitting);
    if (isSignedIn) {
      router.replace(ROUTES.home as Href);
      return;
    }
    if (!isLoaded || submitting) return;

    const identifier = email.trim();
    if (!identifier || !password) {
      FlashMessageComponent({ message: t("Please enter your email and password") });
      return;
    }

    setSubmitting(true);
    try {
      const step1 = await signIn.create({ identifier });
      console.log("[Login] step1 status:", step1.status, "factors:", step1.supportedFirstFactors?.map((f: any) => f.strategy));

      const hasPasswordFactor = step1.supportedFirstFactors?.some(
        (f: any) => f.strategy === "password"
      );

      if (!hasPasswordFactor) {
        console.warn("[Login] no password factor — status:", step1.status);
        FlashMessageComponent({ message: t("Password sign-in is not available for this account. Check your email for a sign-in link.") });
        setSubmitting(false);
        return;
      }

      const attempt = await signIn.attemptFirstFactor({ strategy: "password", password });
      console.log("[Login] attempt status:", attempt.status);

      if (attempt.status === "complete") {
        await setActive({ session: attempt.createdSessionId });
        router.replace(ROUTES.home as Href);
      } else {
        console.warn("[Login] signIn not complete — status:", attempt.status);
        FlashMessageComponent({ message: t("Additional verification is required to sign in") });
      }
    } catch (err: unknown) {
      if (isSessionExists(err)) {
        router.replace(ROUTES.home as Href);
        return;
      }
      console.error("[Login] password error:", extractClerkError(err), err);
      showError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOAuth = async (startOAuthFlow: typeof startGoogleFlow) => {
    // Already authenticated — go home instead of starting a duplicate flow.
    if (isSignedIn) {
      router.replace(ROUTES.home as Href);
      return;
    }
    try {
      // Expo OAuth needs an explicit redirect deep-link to return to the app
      // after the browser auth. Linking.createURL picks the right scheme for
      // the current runtime (exp+food-delivery-rider-multivendor:// in the dev
      // client, myapp:// in a standalone build).
      const redirectUrl = Linking.createURL("/(tabs)/home", { scheme: "myapp" });
      console.log("[Login] OAuth start — redirectUrl:", redirectUrl);

      const { createdSessionId, setActive: setOAuthActive } =
        await startOAuthFlow({ redirectUrl });
      console.log("[Login] OAuth result — createdSessionId:", createdSessionId);

      if (createdSessionId && setOAuthActive) {
        await setOAuthActive({ session: createdSessionId });
        router.replace(ROUTES.home as Href);
      } else {
        // No session means the user closed the browser, or Clerk returned a
        // signIn/signUp that needs another step (e.g. account not provisioned).
        console.warn("[Login] OAuth finished without a session");
      }
    } catch (err: unknown) {
      if (isSessionExists(err)) {
        router.replace(ROUTES.home as Href);
        return;
      }
      console.error("[Login] OAuth error:", extractClerkError(err), err);
      showError(err);
    }
  };

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: appTheme.themeBackground }}
    >
      <KeyboardAvoidingView
        className="flex-1 justify-center items-center px-8"
        behavior={Platform.select({ ios: "padding", android: undefined })}
      >
        <View className="items-center gap-y-4 w-full">
          <Text
            className="text-2xl font-bold text-center mb-2"
            style={{ color: appTheme.fontMainColor }}
          >
            {t("Welcome")}
          </Text>
          <Text
            className="text-sm text-center mb-4"
            style={{ color: appTheme.fontSecondColor }}
          >
            {t("Sign in to continue")}
          </Text>

          {/* Email */}
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder={t("Email")}
            placeholderTextColor={appTheme.fontSecondColor}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            className="w-full h-12 rounded-xl border px-4 text-base"
            style={{
              borderColor: appTheme.borderLineColor,
              color: appTheme.fontMainColor,
              backgroundColor: appTheme.themeBackground,
            }}
            accessibilityLabel={t("Email")}
          />

          {/* Password */}
          <View
            className="flex-row items-center w-full h-12 rounded-xl border px-4"
            style={{
              borderColor: appTheme.borderLineColor,
              backgroundColor: appTheme.themeBackground,
            }}
          >
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={t("Password")}
              placeholderTextColor={appTheme.fontSecondColor}
              autoCapitalize="none"
              secureTextEntry={hidePassword}
              textContentType="password"
              onSubmitEditing={handlePasswordSignIn}
              returnKeyType="go"
              className="flex-1 text-base h-full"
              style={{ color: appTheme.fontMainColor }}
              accessibilityLabel={t("Password")}
            />
            <TouchableOpacity
              onPress={() => setHidePassword((prev) => !prev)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel={
                hidePassword ? t("Show password") : t("Hide password")
              }
              accessibilityRole="button"
            >
              <FontAwesome
                name={hidePassword ? "eye-slash" : "eye"}
                size={18}
                color={appTheme.fontSecondColor}
              />
            </TouchableOpacity>
          </View>

          {/* Sign in button */}
          <TouchableOpacity
            onPress={handlePasswordSignIn}
            disabled={!isLoaded || submitting}
            className="flex-row items-center justify-center w-full h-12 rounded-xl mt-1"
            style={{ backgroundColor: appTheme.primary, opacity: (!isLoaded || submitting) ? 0.7 : 1 }}
            accessibilityLabel={t("Sign in")}
            accessibilityRole="button"
            accessibilityState={{ disabled: !isLoaded || submitting }}
          >
            {(!isLoaded || submitting) ? (
              <ActivityIndicator color={appTheme.black} />
            ) : (
              <Text className="text-base font-semibold" style={{ color: appTheme.black }}>
                {t("Sign in")}
              </Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View className="flex-row items-center w-full my-2">
            <View className="flex-1 h-px" style={{ backgroundColor: appTheme.borderLineColor }} />
            <Text className="mx-3 text-xs" style={{ color: appTheme.fontSecondColor }}>
              {t("OR")}
            </Text>
            <View className="flex-1 h-px" style={{ backgroundColor: appTheme.borderLineColor }} />
          </View>

          <TouchableOpacity
            onPress={() => handleOAuth(startGoogleFlow)}
            className="flex-row items-center justify-center w-full h-12 rounded-xl border gap-x-3"
            style={{
              borderColor: appTheme.borderLineColor,
              backgroundColor: appTheme.themeBackground,
            }}
            accessibilityLabel={t("Sign in with Google")}
            accessibilityRole="button"
          >
            <FontAwesome name="google" size={20} color="#EA4335" />
            <Text className="text-base font-medium" style={{ color: appTheme.fontMainColor }}>
              {t("Continue with Google")}
            </Text>
          </TouchableOpacity>

          {Platform.OS === "ios" && (
            <TouchableOpacity
              onPress={() => handleOAuth(startAppleFlow)}
              className="flex-row items-center justify-center w-full h-12 rounded-xl border gap-x-3"
              style={{
                borderColor: appTheme.borderLineColor,
                backgroundColor: appTheme.themeBackground,
              }}
              accessibilityLabel={t("Sign in with Apple")}
              accessibilityRole="button"
            >
              <FontAwesome name="apple" size={22} color={appTheme.fontMainColor} />
              <Text className="text-base font-medium" style={{ color: appTheme.fontMainColor }}>
                {t("Continue with Apple")}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default LoginScreen;
