import { View, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { OtpInput } from "react-native-otp-entry";
import { useTranslation } from "react-i18next";

import styles from "../otp-styles";
import AuthSpinner from "@/lib/ui/useable-components/auth-spinner";
import TextDefault from "@/lib/ui/useable-components/text-default";
import SignUpSvg from "@/lib/ui/useable-components/svg/sign-up";
import { alignment } from "@/lib/utils/alignment";
import useEmailOtp from "@/lib/hooks/useEmailOtp";

// Ported from enatega-multivendor-app (screens/Otp/Email).
export default function EmailOtpScreen() {
  const {
    setOtp,
    otpError,
    seconds,
    loading,
    onCodeFilled,
    resendOtp,
    currentTheme,
  } = useEmailOtp();

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
                {t("verifyEmail")}
              </TextDefault>
              <TextDefault
                H5
                bold
                textColor={currentTheme.fontSecondColor}
                isRTL
              >
                {t("otpSentToEmail")}
              </TextDefault>
            </View>
            <View style={alignment.MTlarge}>
              <OtpInput
                numberOfDigits={6}
                autoFocus
                hideStick
                focusColor={currentTheme.main}
                onTextChange={(code) => setOtp(code)}
                onFilled={(code) => onCodeFilled(code)}
                theme={{
                  containerStyle: styles().otpInput,
                  pinCodeContainerStyle: {
                    ...styles(currentTheme).otpBox,
                    ...(otpError ? styles(currentTheme).errorInput : {}),
                  },
                  pinCodeTextStyle: {
                    color: currentTheme.newFontcolor,
                  },
                }}
              />
              {otpError && (
                <TextDefault
                  style={styles(currentTheme).error}
                  bold
                  textColor={currentTheme.textErrorColor}
                >
                  {t("wrongOtp")}
                </TextDefault>
              )}
            </View>
          </View>

          <View
            style={{ ...alignment.MTlarge, width: "100%", marginBottom: 20 }}
          >
            <View style={alignment.MBxSmall}>
              <TextDefault
                center
                H4
                bold
                style={alignment.MTsmall}
                textColor={currentTheme.fontNewColor}
              >
                {seconds === 0 ? "" : `${t("retry")} ${seconds}s`}
              </TextDefault>
            </View>
            {loading ? (
              <AuthSpinner
                backColor="transparent"
                spinnerColor={currentTheme.main}
                size="small"
              />
            ) : (
              <TouchableOpacity
                activeOpacity={0.7}
                style={[
                  styles(currentTheme).btn,
                  seconds !== 0 && styles(currentTheme).disabledBtn,
                ]}
                disabled={seconds !== 0}
                onPress={() => resendOtp()}
              >
                <TextDefault H4 textColor={currentTheme.black} bold>
                  {t("resendOtpBtn")}
                </TextDefault>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
