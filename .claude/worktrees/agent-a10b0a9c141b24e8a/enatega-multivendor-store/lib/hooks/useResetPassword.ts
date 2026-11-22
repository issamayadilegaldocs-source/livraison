import { useSignIn } from "@clerk/clerk-expo";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAuthTheme } from "@/lib/hooks/useAuthTheme";
import { useStoreSession } from "@/lib/hooks/useStoreSession";
import { FlashMessageComponent } from "@/lib/ui/useable-components";
import { passRegex } from "@/lib/utils/regex";

// Ported from enatega-multivendor-app (screens/ForgotPassword/useResetYourPassword).
// After a successful reset the Clerk session is activated and the store
// finalizeSession step runs (ownerProfile -> store-id) before routing home.
export const useResetPassword = () => {
  const { t } = useTranslation();
  const { currentTheme, themeContext } = useAuthTheme();
  const { finalizeSession } = useStoreSession();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<
    string | null
  >(null);
  const [loading, setLoading] = useState(false);

  const { signIn, setActive, isLoaded } = useSignIn();

  function validateCredentials() {
    let result = true;
    setPasswordError(null);
    setConfirmPasswordError(null);
    if (!password) {
      setPasswordError(t("passErr1"));
      result = false;
    } else if (!passRegex.test(password)) {
      setPasswordError(t("passErr2"));
      result = false;
    }
    if (!confirmPassword) {
      setConfirmPasswordError(t("confirmPassRequired"));
      result = false;
    }
    return result;
  }

  async function resetYourPassword() {
    if (!isLoaded || !validateCredentials()) return;
    if (password !== confirmPassword) {
      setConfirmPasswordError(t("passwordMustMatch"));
      return;
    }
    setLoading(true);
    try {
      const result = await signIn.resetPassword({ password });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        FlashMessageComponent({ message: t("passwordResetSuccessfully") });
        await finalizeSession();
      }
    } catch (error: unknown) {
      const clerkError = error as {
        errors?: { longMessage?: string; message?: string }[];
      };
      const msg =
        clerkError.errors?.[0]?.longMessage ??
        clerkError.errors?.[0]?.message ??
        (error instanceof Error ? error.message : t("somethingWentWrong"));
      FlashMessageComponent({ message: msg });
    } finally {
      setLoading(false);
    }
  }

  return {
    password,
    setPassword,
    confirmPassword,
    confirmPasswordError,
    setConfirmPassword,
    passwordError,
    resetYourPassword,
    currentTheme,
    themeContext,
    loading,
  };
};
