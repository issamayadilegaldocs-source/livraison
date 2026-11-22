import { useSignUp } from "@clerk/clerk-expo";
import { Href, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAuthTheme } from "@/lib/hooks/useAuthTheme";
import { FlashMessageComponent } from "@/lib/ui/useable-components";
import { ROUTES } from "@/lib/utils/constants";
import { emailRegex, passRegex, nameRegex } from "@/lib/utils/regex";

// Ported from enatega-multivendor-app (screens/Register), adapted for the
// store: the customer's phone/country-picker step only fed the dropped phone
// OTP screen and was never sent to Clerk, so it is omitted here. Clerk signUp
// uses email + name + password, then email verification.
const useRegister = () => {
  const { t } = useTranslation();
  const { currentTheme, themeContext } = useAuthTheme();
  const params = useLocalSearchParams<{ email?: string }>();

  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [email, setEmail] = useState(params?.email ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(true);
  const [firstnameError, setFirstnameError] = useState<string | null>(null);
  const [lastnameError, setLastnameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { signUp, isLoaded } = useSignUp();

  function validateCredentials() {
    let result = true;

    setEmailError(null);
    setPasswordError(null);
    setFirstnameError(null);
    setLastnameError(null);

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
    } else if (!passRegex.test(password)) {
      setPasswordError(t("passErr2"));
      result = false;
    }

    if (!firstname) {
      setFirstnameError(t("firstnameErr1"));
      result = false;
    } else if (!nameRegex.test(firstname)) {
      setFirstnameError(t("firstnameErr2"));
      result = false;
    }

    if (!lastname) {
      setLastnameError(t("lastnameErr1"));
      result = false;
    } else if (!nameRegex.test(lastname)) {
      setLastnameError(t("lastnameErr2"));
      result = false;
    }

    return result;
  }

  async function registerAction() {
    if (!isLoaded || !validateCredentials()) return;
    setLoading(true);
    try {
      await signUp.create({
        emailAddress: email.toLowerCase().trim(),
        password,
        firstName: firstname,
        lastName: lastname,
      });

      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });

      const query = new URLSearchParams({
        email: email.toLowerCase().trim(),
        name: `${firstname} ${lastname}`,
      }).toString();
      router.push(`${ROUTES.emailOtp}?${query}` as Href);
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
    firstname,
    setFirstname,
    firstnameError,
    lastname,
    setLastname,
    lastnameError,
    password,
    setPassword,
    passwordError,
    showPassword,
    setShowPassword,
    registerAction,
    currentTheme,
    themeContext,
    loading,
  };
};

export default useRegister;
