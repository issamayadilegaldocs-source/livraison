import { StyleSheet } from "react-native";

import { alignment } from "@/lib/utils/alignment";
import { scale } from "@/lib/utils/scaling";
import { AuthTheme } from "@/lib/utils/themeColors";

// Ported from enatega-multivendor-app (screens/Otp/styles). Shared by the
// email verification and forgot-password OTP screens.
const styles = (props: AuthTheme | null = null) =>
  StyleSheet.create({
    flex: {
      flex: 1,
    },
    safeAreaViewStyles: {
      flex: 1,
      backgroundColor: props !== null ? props?.themeBackground : "transparent",
    },
    mainContainer: {
      flex: 1,
      alignItems: "center",
      backgroundColor: props !== null ? props?.themeBackground : "transparent",
      ...alignment.MTlarge,
      ...alignment.PLlarge,
      ...alignment.PRlarge,
      flexDirection: "column",
      justifyContent: "space-between",
    },
    subContainer: {
      width: "100%",
    },
    errorInput: {
      backgroundColor: props !== null ? props?.errorInputBack : "#F7E7E5",
      borderColor: props !== null ? props?.errorInputBorder : "#DB4A39",
    },
    btn: {
      width: "100%",
      alignItems: "center",
      backgroundColor: props !== null ? props?.main : "#F7E7E5",
      alignSelf: "center",
      padding: 15,
      borderRadius: 40,
    },
    otpInput: {
      height: 70,
    },
    error: {
      ...alignment.MBlarge,
    },
    otpBox: {
      backgroundColor: props !== null ? props?.themeBackground : "#F7E7E5",
      borderColor: props !== null ? props?.borderColor : "#efefef",
      borderWidth: scale(1),
      borderRadius: scale(6),
    },
    disabledBtn: {
      backgroundColor: props !== null ? props?.iconBackground : "#333333",
    },
  });

export default styles;
