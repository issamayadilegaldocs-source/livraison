import { StyleSheet } from "react-native";

import { alignment } from "@/lib/utils/alignment";
import { scale } from "@/lib/utils/scaling";
import { AuthTheme } from "@/lib/utils/themeColors";

// Ported from enatega-multivendor-app (screens/Register/styles).
const styles = (props: AuthTheme | null = null) =>
  StyleSheet.create({
    flex: {
      flex: 1,
    },
    mainContainer: {
      flex: 1,
      alignItems: "center",
      backgroundColor: props !== null ? props?.themeBackground : "transparent",
      ...alignment.MTlarge,
      ...alignment.MBlarge,
      ...alignment.MLmedium,
      ...alignment.MRmedium,
      flexDirection: "column",
      justifyContent: "space-between",
    },
    subContainer: {
      width: "100%",
    },
    form: {
      width: "100%",
    },
    textField: {
      borderColor: props !== null ? props?.borderColor : "#efefef",
      borderWidth: scale(1),
      borderRadius: scale(10),
      backgroundColor: props !== null ? props?.themeBackground : "white",
      padding: scale(12),
      color: props !== null ? props?.newFontcolor : "red",
      ...alignment.MBxSmall,
      ...alignment.MTxSmall,
      textAlign: props?.isRTL ? "right" : "left",
    },
    passwordField: {
      display: "flex",
      flexDirection: props?.isRTL ? "row-reverse" : "row",
      alignItems: "center",
    },
    passwordInput: {
      width: "100%",
      alignItems: "center",
    },
    eyeBtn: {
      zIndex: 1,
      elevation: 999,
      ...(props?.isRTL ? { marginRight: -40 } : { marginLeft: -40 }),
    },
    btnContainer: {
      width: "100%",
      marginTop: scale(10),
    },
    btn: {
      width: "100%",
      alignItems: "center",
      backgroundColor: props !== null ? props?.main : "#000",
      alignSelf: "center",
      padding: 15,
      borderRadius: 40,
    },
    error: {
      marginTop: 3,
    },
    errorInput: {
      backgroundColor: props !== null ? props?.errorInputBack : "#F7E7E5",
      borderColor: props !== null ? props?.errorInputBorder : "#DB4A39",
    },
  });

export default styles;
