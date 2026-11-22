import { View, TouchableOpacity, TextInput, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import styles from "./styles";
import AuthSpinner from "@/lib/ui/useable-components/auth-spinner";
import TextDefault from "@/lib/ui/useable-components/text-default";
import SignUpSvg from "@/lib/ui/useable-components/svg/sign-up";
import { alignment } from "@/lib/utils/alignment";
import { useForgotPassword } from "@/lib/hooks/useForgotPassword";

// Ported from enatega-multivendor-app (screens/ForgotPassword).
export default function ForgotPasswordScreen() {
  const { email, setEmail, emailError, forgotPassword, currentTheme, loading } =
    useForgotPassword();
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
                {t("forgotPassword")}
              </TextDefault>
              <TextDefault
                H5
                bold
                textColor={currentTheme.fontSecondColor}
                style={styles().emailHeading}
                isRTL
              >
                {t("enterYourEmail")}
              </TextDefault>
            </View>
            <View>
              <TextInput
                placeholder={t("email")}
                style={[
                  styles(currentTheme).textField,
                  emailError !== null ? styles(currentTheme).errorInput : {},
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
                >
                  {emailError}
                </TextDefault>
              )}
            </View>
          </View>
          <View style={{ width: "100%", marginBottom: 20 }}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles(currentTheme).btn}
              onPress={() => forgotPassword()}
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
                  {t("continueBtn")}
                </TextDefault>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
