import { View, TouchableOpacity, TextInput, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import styles from "../forgot-password/styles";
import AuthSpinner from "@/lib/ui/useable-components/auth-spinner";
import TextDefault from "@/lib/ui/useable-components/text-default";
import SignUpSvg from "@/lib/ui/useable-components/svg/sign-up";
import { alignment } from "@/lib/utils/alignment";
import { useResetPassword } from "@/lib/hooks/useResetPassword";

// Ported from enatega-multivendor-app (screens/ForgotPassword/SetYourPassword).
export default function SetPasswordScreen() {
  const {
    password,
    setPassword,
    confirmPassword,
    confirmPasswordError,
    setConfirmPassword,
    passwordError,
    currentTheme,
    resetYourPassword,
    loading,
  } = useResetPassword();
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles(currentTheme).safeAreaViewStyles}>
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
                {t("setYourPassword")}
              </TextDefault>
              <TextDefault
                H5
                bold
                textColor={currentTheme.fontSecondColor}
                style={styles().enterPass}
                isRTL
              >
                {t("enterPass")}
              </TextDefault>
            </View>
            <View style={styles().passwordField}>
              <TextInput
                secureTextEntry
                placeholder={t("password")}
                style={[
                  styles(currentTheme).textField,
                  styles(currentTheme).passwordInput,
                  passwordError ? styles(currentTheme).errorInput : {},
                ]}
                placeholderTextColor={currentTheme.fontSecondColor}
                value={password}
                onChangeText={(e) => setPassword(e)}
              />
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
            <View style={[styles().passwordField, styles().confirmField]}>
              <TextInput
                secureTextEntry
                placeholder={t("confirmPassword")}
                style={[
                  styles(currentTheme).textField,
                  styles(currentTheme).passwordInput,
                  confirmPasswordError ? styles(currentTheme).errorInput : {},
                ]}
                placeholderTextColor={currentTheme.fontSecondColor}
                value={confirmPassword}
                onChangeText={(e) => setConfirmPassword(e)}
              />
            </View>
            {confirmPasswordError && (
              <View>
                <TextDefault
                  style={styles().error}
                  bold
                  textColor={currentTheme.textErrorColor}
                  isRTL
                >
                  {confirmPasswordError}
                </TextDefault>
              </View>
            )}
          </View>
          <View style={{ width: "100%", marginBottom: 20 }}>
            <TouchableOpacity
              onPress={() => resetYourPassword()}
              activeOpacity={0.7}
              style={styles(currentTheme).btn}
              disabled={loading}
            >
              {loading ? (
                <AuthSpinner
                  size="small"
                  backColor="transparent"
                  spinnerColor={currentTheme.white}
                />
              ) : (
                <TextDefault H4 textColor={currentTheme.black} bold>
                  {t("saveBtn")}
                </TextDefault>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
