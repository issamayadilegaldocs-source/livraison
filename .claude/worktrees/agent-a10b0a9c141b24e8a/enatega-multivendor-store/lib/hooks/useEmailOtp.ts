import { useSignUp } from "@clerk/clerk-expo";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAuthTheme } from "@/lib/hooks/useAuthTheme";
import { useStoreSession } from "@/lib/hooks/useStoreSession";
import { FlashMessageComponent } from "@/lib/ui/useable-components";

// Ported from enatega-multivendor-app (screens/Otp/Email). After verifying the
// email and activating the Clerk session, the store finalizeSession step runs
// (ownerProfile -> store-id) instead of the customer app's phone OTP screen.
const useEmailOtp = () => {
  const { t } = useTranslation();
  const { currentTheme, themeContext } = useAuthTheme();
  const params = useLocalSearchParams<{ email?: string; name?: string }>();
  const { finalizeSession } = useStoreSession();

  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState(false);
  const [seconds, setSeconds] = useState(30);
  const [submitting, setSubmitting] = useState(false);

  const { signUp, setActive, isLoaded } = useSignUp();

  const onCodeFilled = async (otp_code: string) => {
    if (!isLoaded) return;
    setSubmitting(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: otp_code,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        FlashMessageComponent({ message: t("accountCreated") });
        await finalizeSession();
      } else {
        setOtpError(true);
      }
    } catch (error: unknown) {
      const clerkError = error as {
        errors?: { longMessage?: string; message?: string }[];
      };
      const msg =
        clerkError.errors?.[0]?.longMessage ??
        clerkError.errors?.[0]?.message;
      if (msg) {
        FlashMessageComponent({ message: msg });
      }
      setOtpError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const resendOtp = async () => {
    if (!isLoaded) return;
    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setSeconds(30);
      FlashMessageComponent({ message: t("otpSentToEmail") });
    } catch {
      FlashMessageComponent({ message: t("somethingWentWrong") });
    }
  };

  useEffect(() => {
    const myInterval = setInterval(() => {
      setSeconds((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(myInterval);
  }, []);

  return {
    otp,
    setOtp,
    otpError,
    seconds,
    loading: !isLoaded || submitting,
    onCodeFilled,
    resendOtp,
    currentTheme,
    themeContext,
    email: params?.email,
  };
};

export default useEmailOtp;
