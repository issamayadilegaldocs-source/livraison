import { useEffect } from "react";
import {
  View,
  TouchableOpacity,
  ScrollView,
  Platform,
  TextInput,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, FontAwesome } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { useTranslation } from "react-i18next";

import styles from "./styles";
import AuthSpinner from "@/lib/ui/useable-components/auth-spinner";
import TextDefault from "@/lib/ui/useable-components/text-default";
import SignUpSvg from "@/lib/ui/useable-components/svg/sign-up";
import { alignment } from "@/lib/utils/alignment";
import useLogin from "@/lib/hooks/useLogin";

// Required for the OAuth web browser redirect to dismiss correctly.
WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const {
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
    onGoogleLogin,
    onAppleLogin,
    goToRegister,
    goToForgotPassword,
  } = useLogin();
  const { t } = useTranslation();

  // Warm up the browser on Android for a faster OAuth handoff.
  useEffect(() => {
    if (Platform.OS !== "android") return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);

  const isLoading = loadingProvider !== null;

  return (
    <SafeAreaView
      edges={["top", "bottom", "left", "right"]}
      style={styles(currentTheme).safeAreaViewStyles}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles().flex}
      >
        <ScrollView
          style={styles().flex}
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          alwaysBounceVertical={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles(currentTheme).mainContainer}>
            <View style={styles().subContainer}>
              <SignUpSvg
                fillColor={currentTheme.svgFill}
                strokeColor={currentTheme.newIconColor}
              />
              <TextDefault
                H2
                bolder
                center
                textColor={currentTheme.newFontcolor}
                style={{ ...alignment.MTlarge, ...alignment.MBsmall }}
              >
                {t("signInToContinue")}
              </TextDefault>

              {/* Email / password form */}
              <View style={styles().form}>
                <TextInput
                  placeholder={t("email")}
                  style={[
                    styles(currentTheme).textField,
                    emailError ? styles(currentTheme).errorInput : {},
                  ]}
                  placeholderTextColor={currentTheme.fontSecondColor}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="emailAddress"
                  value={email}
                  onChangeText={setEmail}
                  editable={!isLoading}
                  accessibilityLabel={t("email")}
                />
                {emailError && (
                  <TextDefault
                    style={styles().error}
                    bold
                    textColor={currentTheme.textErrorColor}
                  >
                    {emailError}
                  </TextDefault>
                )}

                <View style={styles(currentTheme).passwordField}>
                  <TextInput
                    secureTextEntry={showPassword}
                    placeholder={t("password")}
                    style={[
                      styles(currentTheme).textField,
                      styles().passwordInput,
                      passwordError ? styles(currentTheme).errorInput : {},
                    ]}
                    placeholderTextColor={currentTheme.fontSecondColor}
                    autoCapitalize="none"
                    autoComplete="password"
                    textContentType="password"
                    value={password}
                    onChangeText={setPassword}
                    editable={!isLoading}
                    onSubmitEditing={onEmailLogin}
                    returnKeyType="go"
                    accessibilityLabel={t("password")}
                  />
                  <FontAwesome
                    onPress={() => setShowPassword(!showPassword)}
                    name={showPassword ? "eye" : "eye-slash"}
                    size={22}
                    color={currentTheme.fontFourthColor}
                    style={styles(currentTheme).eyeBtn}
                    accessibilityLabel={t("password")}
                  />
                </View>
                {passwordError && (
                  <TextDefault
                    style={styles().error}
                    bold
                    textColor={currentTheme.textErrorColor}
                  >
                    {passwordError}
                  </TextDefault>
                )}

                <TouchableOpacity
                  onPress={goToForgotPassword}
                  disabled={isLoading}
                  style={styles(currentTheme).forgotPassword}
                  accessibilityRole="button"
                  accessibilityLabel={t("forgotPassword")}
                >
                  <TextDefault H5 bold textColor={currentTheme.main}>
                    {t("forgotPassword")}
                  </TextDefault>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles().buttonsContainer}>
              {/* Email login */}
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles(currentTheme).loginBtn}
                onPress={onEmailLogin}
                disabled={isLoading}
                accessibilityRole="button"
                accessibilityLabel={t("loginBtn")}
              >
                {loadingProvider === "email" ? (
                  <AuthSpinner
                    backColor="transparent"
                    spinnerColor={currentTheme.black}
                    size="small"
                  />
                ) : (
                  <TextDefault H4 bold textColor={currentTheme.black}>
                    {t("loginBtn")}
                  </TextDefault>
                )}
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles(currentTheme).dividerRow}>
                <View style={styles(currentTheme).dividerLine} />
                <TextDefault
                  H5
                  bold
                  textColor={currentTheme.horizontalLine}
                  style={styles().dividerText}
                >
                  {t("orContinueWith")}
                </TextDefault>
                <View style={styles(currentTheme).dividerLine} />
              </View>

              {/* Google */}
              <TouchableOpacity
                activeOpacity={0.7}
                style={[
                  styles(currentTheme).socialBtn,
                  styles(currentTheme).googleBtn,
                ]}
                onPress={onGoogleLogin}
                disabled={isLoading}
                accessibilityRole="button"
                accessibilityLabel={t("continueWithGoogle")}
              >
                {loadingProvider === "oauth_google" ? (
                  <AuthSpinner
                    backColor="transparent"
                    spinnerColor={currentTheme.black}
                    size="small"
                  />
                ) : (
                  <>
                    <Ionicons
                      name="logo-google"
                      size={22}
                      color="#000"
                      style={styles(currentTheme).btnIcon}
                    />
                    <TextDefault H4 bold textColor={currentTheme.black}>
                      {t("continueWithGoogle")}
                    </TextDefault>
                  </>
                )}
              </TouchableOpacity>

              {/* Apple */}
              <TouchableOpacity
                activeOpacity={0.7}
                style={[
                  styles(currentTheme).socialBtn,
                  styles(currentTheme).appleBtn,
                ]}
                onPress={onAppleLogin}
                disabled={isLoading}
                accessibilityRole="button"
                accessibilityLabel={t("continueWithApple")}
              >
                {loadingProvider === "oauth_apple" ? (
                  <AuthSpinner
                    backColor="transparent"
                    spinnerColor={currentTheme.white}
                    size="small"
                  />
                ) : (
                  <>
                    <Ionicons
                      name="logo-apple"
                      size={22}
                      color="#fff"
                      style={styles(currentTheme).btnIcon}
                    />
                    <TextDefault H4 bold textColor={currentTheme.white}>
                      {t("continueWithApple")}
                    </TextDefault>
                  </>
                )}
              </TouchableOpacity>

              {/* Sign up */}
              <View style={styles().signUpRow}>
                <TextDefault H5 textColor={currentTheme.fontSecondColor}>
                  {t("dontHaveAccount")}{" "}
                </TextDefault>
                <TouchableOpacity
                  onPress={goToRegister}
                  disabled={isLoading}
                  accessibilityRole="button"
                  accessibilityLabel={t("getRegistered")}
                >
                  <TextDefault H5 bold textColor={currentTheme.main}>
                    {t("getRegistered")}
                  </TextDefault>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
