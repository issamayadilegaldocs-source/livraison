import React, { forwardRef, ReactNode } from "react";
import { Text, StyleSheet, StyleProp, TextStyle } from "react-native";

import { textStyles } from "@/lib/utils/textStyles";
import { useAuthTheme } from "@/lib/hooks/useAuthTheme";

interface ITextDefaultProps {
  children?: ReactNode;
  textColor?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  bold?: boolean;
  bolder?: boolean;
  center?: boolean;
  right?: boolean;
  left?: boolean;
  small?: boolean;
  smaller?: boolean;
  H1?: boolean;
  H2?: boolean;
  H3?: boolean;
  H4?: boolean;
  H5?: boolean;
  uppercase?: boolean;
  lineOver?: boolean;
  B700?: boolean;
  textItalic?: boolean;
  isRTL?: boolean;
}

// Ported from enatega-multivendor-app (components/Text/TextDefault).
function TextDefault(
  props: ITextDefaultProps,
  ref: React.Ref<Text>,
) {
  const { themeContext, currentTheme } = useAuthTheme();

  const textColor = props.textColor
    ? props.textColor
    : themeContext.ThemeValue === "Dark"
      ? "white"
      : "black";

  const defaultStyle = StyleSheet.flatten([
    { color: textColor },
    textStyles.Regular,
    textStyles.Normal,
  ]);

  const customStyles: StyleProp<TextStyle>[] = [defaultStyle];

  if (props.bold) customStyles.push(textStyles.Bold);
  if (props.bolder) customStyles.push(textStyles.Bolder);
  if (props.center) customStyles.push(textStyles.Center);
  if (props.right) customStyles.push(textStyles.Right);
  if (props.small) customStyles.push(textStyles.Small);
  if (props.smaller) customStyles.push(textStyles.Smaller);
  if (props.H5) customStyles.push(textStyles.H5);
  if (props.H4) customStyles.push(textStyles.H4);
  if (props.H3) customStyles.push(textStyles.H3);
  if (props.H2) customStyles.push(textStyles.H2);
  if (props.H1) customStyles.push(textStyles.H1);
  if (props.uppercase) customStyles.push(textStyles.UpperCase);
  if (props.lineOver) customStyles.push(textStyles.LineOver);
  if (props.B700) customStyles.push(textStyles.B700);
  if (props.textItalic) customStyles.push(textStyles.TextItalic);
  if (props.left) customStyles.push(textStyles.Left);
  if (props.isRTL)
    customStyles.push(currentTheme?.isRTL ? textStyles.Right : textStyles.Left);

  const flattened = StyleSheet.flatten([customStyles, props.style]);

  return (
    <Text
      numberOfLines={props.numberOfLines ? props.numberOfLines : 0}
      style={flattened}
      ref={ref}
    >
      {props.children}
    </Text>
  );
}

export default forwardRef(TextDefault);
