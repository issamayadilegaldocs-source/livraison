import { StyleSheet } from "react-native";

import { alignment } from "@/lib/utils/alignment";
import { scale } from "@/lib/utils/scaling";
import { AuthTheme } from "@/lib/utils/themeColors";

// Email/password + social login styles.
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
      justifyContent: "space-between",
      backgroundColor: props !== null ? props?.themeBackground : "transparent",
      ...alignment.PTlarge,
    },
    subContainer: {
      width: "90%",
      flex: 1,
      flexDirection: "column",
      justifyContent: "center",
    },
    form: {
      width: "100%",
      ...alignment.MTlarge,
    },
    textField: {
      width: "100%",
      height: scale(44),
      borderWidth: scale(1),
      borderRadius: scale(8),
      borderColor: props !== null ? props?.borderColor : "#efefef",
      color: props !== null ? props?.newFontcolor : "#000",
      backgroundColor: props !== null ? props?.themeBackground : "#fff",
      paddingHorizontal: scale(12),
      ...alignment.MBsmall,
    },
    errorInput: {
      borderColor: props !== null ? props?.textErrorColor : "#db4337",
    },
    passwordField: {
      flexDirection: "row",
      alignItems: "center",
    },
    passwordInput: {
      flex: 1,
    },
    eyeBtn: {
      ...(props?.isRTL
        ? { marginRight: scale(-36), zIndex: 1 }
        : { marginLeft: scale(-36), zIndex: 1 }),
      paddingBottom: scale(8),
    },
    error: {
      ...alignment.MBsmall,
    },
    forgotPassword: {
      alignSelf: props?.isRTL ? "flex-start" : "flex-end",
      ...alignment.MTxSmall,
    },
    buttonsContainer: {
      width: "90%",
      ...alignment.MBxLarge,
    },
    loginBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
      padding: scale(14),
      borderRadius: scale(28),
      backgroundColor: props !== null ? props?.main : "#94e469",
      ...alignment.MBmedium,
    },
    dividerRow: {
      flexDirection: "row",
      alignItems: "center",
      width: "100%",
      ...alignment.MBmedium,
    },
    dividerLine: {
      flex: 1,
      height: scale(1),
      backgroundColor: props !== null ? props?.borderColor : "#efefef",
    },
    dividerText: {
      ...alignment.MLsmall,
      ...alignment.MRsmall,
    },
    socialBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
      padding: scale(14),
      borderRadius: scale(28),
      borderWidth: scale(1),
      ...alignment.MBsmall,
    },
    googleBtn: {
      backgroundColor: props !== null ? props?.white : "#fff",
      borderColor: props !== null ? props?.borderColor : "#efefef",
    },
    appleBtn: {
      backgroundColor: "#000",
      borderColor: "#000",
    },
    btnIcon: {
      ...(props?.isRTL ? { marginLeft: scale(10) } : { marginRight: scale(10) }),
    },
    signUpRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      ...alignment.MTsmall,
    },
  });

export default styles;
