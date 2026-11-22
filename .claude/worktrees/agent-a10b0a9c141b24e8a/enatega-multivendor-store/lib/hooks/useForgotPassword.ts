import { useSignIn } from "@clerk/clerk-expo";
import { Href, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAuthTheme } from "@/lib/hooks/useAuthTheme";
import { FlashMessageComponent } from "@/lib/ui/useable-components";
import { ROUTES } from "@/lib/utils/constants";
import { emailRegex } from "@/lib/utils/regex";

// Ported from enatega-multivendor-app (screens/ForgotPassword).
export const useForgotPassword = () => {
  const { t } = useTranslation();
  const { currentTheme, themeContext } = useAuthTheme();
  const params = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState(params?.email ?? "");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { signIn, isLoaded } = useSignIn();

  function validateCredentials() {
    setEmailError(null);
    if (!email) {
      setEmailError(t("emailErr1"));
      return false;
    }
    if (!emailRegex.test(email)) {
      setEmailError(t("emailErr2"));
      return false;
    }
    return true;
  }

  async function forgotPassword() {
    if (!isLoaded || !validateCredentials()) return;
    setLoading(true);
    try {
      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: email.toLowerCase().trim(),
      });
      router.push(
        `${ROUTES.forgotPasswordOtp}?email=${encodeURIComponent(email.toLowerCase().trim())}` as Href,
      );
    } catch (error: unknown) {
      const clerkError = error as {
        errors?: { longMessage?: string; message?: string }[];
      };
      const msg =
        clerkError.errors?.[0]?.longMessage ??
        clerkError.errors?.[0]?.message ??
        t("somethingWentWrong");
      FlashMessageComponent({ message: msg });
    } finally {
      setLoading(false);
    }
  }

  return {
    email,
    setEmail,
    emailError,
    forgotPassword,
    themeContext,
    currentTheme,
    loading,
  };
};
