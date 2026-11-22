import { useSignIn } from "@clerk/clerk-expo";
import { Href, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAuthTheme } from "@/lib/hooks/useAuthTheme";
import { FlashMessageComponent } from "@/lib/ui/useable-components";
import { ROUTES } from "@/lib/utils/constants";

// Ported from enatega-multivendor-app (screens/Otp/ForgotPassword).
export const useForgotPasswordOtp = () => {
  const { t } = useTranslation();
  const { currentTheme, themeContext } = useAuthTheme();
  const params = useLocalSearchParams<{ email?: string }>();

  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState(false);
  const [email] = useState(params?.email ?? "");
  const [seconds, setSeconds] = useState(30);
  const [loading, setLoading] = useState(false);

  const { signIn, isLoaded } = useSignIn();

  const onCodeFilled = async (code: string) => {
    if (!isLoaded) return;
    setLoading(true);
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code,
      });
      if (result.status === "needs_new_password") {
        router.push(
          `${ROUTES.setPassword}?email=${encodeURIComponent(email)}` as Href,
        );
      } else {
        setOtpError(true);
      }
    } catch {
      setOtpError(true);
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    if (!isLoaded) return;
    try {
      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: email.toLowerCase().trim(),
      });
      setSeconds(30);
      FlashMessageComponent({ message: t("otpResentToEmail") });
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
    currentTheme,
    loading,
    onCodeFilled,
    themeContext,
    resendOtp,
    email,
  };
};
