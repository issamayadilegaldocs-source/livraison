import {
  View,
  TouchableOpacity,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FontAwesome } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import styles from "./styles";
import AuthSpinner from "@/lib/ui/useable-components/auth-spinner";
import TextDefault from "@/lib/ui/useable-components/text-default";
import SignUpSvg from "@/lib/ui/useable-components/svg/sign-up";
import { alignment } from "@/lib/utils/alignment";
import useRegister from "@/lib/hooks/useRegister";

// Ported from enatega-multivendor-app (screens/Register).
export default function RegisterScreen() {
  const {
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
    loading,
  } = useRegister();

  const { t } = useTranslation();

  return (
    <SafeAreaView
      edges={["bottom", "left", "right"]}
      style={[
        styles().flex,
        { backgroundColor: currentTheme.themeBackground },
      ]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles().flex}
      >
        <ScrollView
          style={styles().flex}
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          alwaysBounceVertical={false}
        >
          <View style={styles(currentTheme).mainContainer}>
            <View style={styles().subContainer}>
              <View>
                <SignUpSvg
                  fillColor={currentTheme.svgFill}
                  strokeColor={currentTheme.newIconColor}
                />
              </View>
              <View>
                <TextDefault
                  H2
                  bolder
                  textColor={currentTheme.newFontcolor}
                  style={{ ...alignment.MTlarge, ...alignment.MBmedium }}
                  isRTL
                >
                  {t("letsGetStarted")}
                </TextDefault>
                <TextDefault
                  H5
                  bold
                  textColor={currentTheme.fontSecondColor}
                  style={{ ...alignment.PBmedium }}
                  isRTL
                >
                  {t("createAccountFirst")}
                </TextDefault>
              </View>
              <View style={styles().form}>
                <View>
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
                    value={email}
                    onChangeText={(e) => setEmail(e)}
                  />
                  {emailError && (
                    <TextDefault
                      style={styles().error}
                      bold
                      textColor={currentTheme.textErrorColor}
                      isRTL
                    >
                      {emailError}
                    </TextDefault>
                  )}
                </View>
                <View>
                  <TextInput
                    placeholder={t("firstNamePH")}
                    style={[
                      styles(currentTheme).textField,
                      firstnameError ? styles(currentTheme).errorInput : {},
                    ]}
                    placeholderTextColor={currentTheme.fontSecondColor}
                    value={firstname}
                    onChangeText={(e) => setFirstname(e)}
                  />
                  {firstnameError && (
                    <TextDefault
                      style={styles().error}
                      bold
                      textColor={currentTheme.textErrorColor}
                      isRTL
                    >
                      {firstnameError}
                    </TextDefault>
                  )}
                </View>
                <View>
                  <TextInput
                    placeholder={t("lastNamePH")}
                    style={[
                      styles(currentTheme).textField,
                      lastnameError ? styles(currentTheme).errorInput : {},
                    ]}
                    placeholderTextColor={currentTheme.fontSecondColor}
                    value={lastname}
                    onChangeText={(e) => setLastname(e)}
                  />
                  {lastnameError && (
                    <TextDefault
                      style={styles().error}
                      bold
                      textColor={currentTheme.textErrorColor}
                      isRTL
                    >
                      {lastnameError}
                    </TextDefault>
                  )}
                </View>
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
                    value={password}
                    onChangeText={(e) => setPassword(e)}
                  />
                  <View>
                    <FontAwesome
                      onPress={() => setShowPassword(!showPassword)}
                      name={showPassword ? "eye" : "eye-slash"}
                      size={24}
                      color={currentTheme.fontFourthColor}
                      style={styles(currentTheme).eyeBtn}
                    />
                  </View>
                </View>
                {passwordError && (
                  <View>
                    <TextDefault
                      style={styles().error}
                      bold
                      textColor={currentTheme.textErrorColor}
                      isRTL
                    >
                      {passwordError}
                    </TextDefault>
                  </View>
                )}
              </View>
            </View>
            <View style={styles().btnContainer}>
              <TouchableOpacity
                onPress={() => registerAction()}
                activeOpacity={0.7}
                style={styles(currentTheme).btn}
                disabled={loading}
              >
                {loading ? (
                  <AuthSpinner
                    backColor="transparent"
                    spinnerColor={currentTheme.white}
                    size="small"
                  />
                ) : (
                  <TextDefault H4 textColor={currentTheme.black} bold>
                    {t("getRegistered")}
                  </TextDefault>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
