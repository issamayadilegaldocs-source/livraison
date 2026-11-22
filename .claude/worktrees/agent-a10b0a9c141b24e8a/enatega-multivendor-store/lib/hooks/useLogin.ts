import { useSSO, useClerk, useAuth, useSignIn } from "@clerk/clerk-expo";
import * as AuthSession from "expo-auth-session";
import * as SecureStore from "../utils/safeSecureStore";
import { Href, router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAuthTheme } from "@/lib/hooks/useAuthTheme";
import { useStoreSession } from "@/lib/hooks/useStoreSession";
import { FlashMessageComponent } from "@/lib/ui/useable-components";
import { ROUTES } from "@/lib/utils/constants";
import { emailRegex } from "@/lib/utils/regex";

type SocialStrategy = "oauth_google" | "oauth_apple";
type Provider = SocialStrategy | "email";

// Email/password plus social login. A Clerk sign-in (password) or OAuth (Google
// / Apple) flow creates/activates the session, then the store finalizeSession
// step runs (ownerProfile -> store-id) before routing home.
const useLogin = () => {
  const { t } = useTranslation();
  const { currentTheme } = useAuthTheme();
  const { startSSOFlow } = useSSO();
  const { signOut } = useClerk();
  const { isSignedIn } = useAuth();
  const { signIn, setActive, isLoaded } = useSignIn();
  const { finalizeSession } = useStoreSession();

  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(true);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Clear any active/half-finished session (e.g. an account that signed in but
  // was never linked to a store) so a fresh login flow can start.
  const clearStaleSession = async () => {
    try {
      await signOut();
    } catch {
      // ignore — there may be no active session
    }
    await SecureStore.deleteItemAsync("store-id");
  };

  // Map a Clerk (or generic) error to a user-facing message and flash it.
  const flashError = (error: unknown) => {
    const clerkError = error as {
      errors?: { longMessage?: string; message?: string }[];
    };
    const msg =
      clerkError.errors?.[0]?.longMessage ??
      clerkError.errors?.[0]?.message ??
      (error instanceof Error ? error.message : t("somethingWentWrong"));
    FlashMessageComponent({ message: msg });
  };

  const validateCredentials = () => {
    let result = true;
    setEmailError(null);
    setPasswordError(null);

    if (!email) {
      setEmailError(t("emailErr1"));
      result = false;
    } else if (!emailRegex.test(email.trim())) {
      setEmailError(t("emailErr2"));
      result = false;
    }

    if (!password) {
      setPasswordError(t("passErr1"));
      result = false;
    }

    return result;
  };

  const onEmailLogin = async () => {
    if (loadingProvider || !isLoaded || !validateCredentials()) return;
    setLoadingProvider("email");
    try {
      // signIn.create refuses to run while a session is active, so drop any
      // leftover session first (this also recovers a "not linked" account).
      if (isSignedIn) {
        await clearStaleSession();
      }

      let result;
      try {
        result = await signIn.create({
          identifier: email.toLowerCase().trim(),
          password,
        });
      } catch (error: unknown) {
        const clerkError = error as { errors?: { code?: string }[] };
        // `isSignedIn` above can lag behind Clerk's own client state right
        // after a session was just created (e.g. this same tab a moment
        // ago) — signIn.create then throws "session_exists" instead of the
        // stale-session check catching it. There's already a valid active
        // session at this point, so finish onboarding into the store instead
        // of surfacing an error and leaving the user stuck on the login form.
        if (clerkError.errors?.[0]?.code === "session_exists") {
          await finalizeSession();
          return;
        }
        throw error;
      }

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        try {
          await finalizeSession();
        } catch (linkError) {
          // Authenticated but not linked to a store. Tear the session back
          // down so the user can try a different account.
          await clearStaleSession();
          throw linkError;
        }
      } else {
        // Additional factors (e.g. MFA) aren't supported in the store flow.
        FlashMessageComponent({ message: t("errorInLoginError") });
      }
    } catch (error: unknown) {
      flashError(error);
    } finally {
      setLoadingProvider(null);
    }
  };

  const onSocialLogin = async (strategy: SocialStrategy) => {
    if (loadingProvider) return;
    setLoadingProvider(strategy);
    try {
      // startSSOFlow refuses to run while a session is active, so drop any
      // leftover session first (this also recovers a "not linked" account).
      if (isSignedIn) {
        await clearStaleSession();
      }

      const { createdSessionId, setActive: setActiveSSO } = await startSSOFlow({
        strategy,
        // Use the app's own native scheme (registered in AndroidManifest.xml)
        // so the OAuth callback deep-links straight back into the existing
        // singleTask activity. Passing no scheme makes makeRedirectUri() return
        // the dev-client proxy URL, which on Android recreates the activity and
        // reloads the bundle before setActive() can persist the session —
        // dropping the user silently back on login. iOS is unaffected.
        redirectUrl: AuthSession.makeRedirectUri({
          scheme: "enategastore",
          path: "sso-callback",
        }),
      });

      // No session means the user cancelled the OAuth flow — stay on login.
      if (createdSessionId && setActiveSSO) {
        await setActiveSSO({ session: createdSessionId });
        try {
          await finalizeSession();
        } catch (linkError) {
          // The account authenticated but isn't linked to a store. Tear the
          // session back down so the user can try a different account.
          await clearStaleSession();
          throw linkError;
        }
      }
    } catch (error: unknown) {
      flashError(error);
    } finally {
      setLoadingProvider(null);
    }
  };

  return {
    currentTheme,
    loadingProvider,
    email,
    setEmail,
    emailError,
    password,
    setPassword,
    passwordError,
    showPassword,
    setShowPassword,
    onEmailLogin,
    onGoogleLogin: () => onSocialLogin("oauth_google"),
    onAppleLogin: () => onSocialLogin("oauth_apple"),
    goToRegister: () => router.push(ROUTES.register as Href),
    goToForgotPassword: () => router.push(ROUTES.forgotPassword as Href),
  };
};

export default useLogin;
