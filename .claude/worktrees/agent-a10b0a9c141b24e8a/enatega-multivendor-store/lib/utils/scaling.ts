import { Dimensions } from "react-native";

const { width, height } = Dimensions.get("window");
// Guideline sizes are based on standard ~5" screen mobile device
const guidelineBaseWidth = 350;
const guidelineBaseHeight = 680;

export const scale = (size: number) =>
  Math.round((width / guidelineBaseWidth) * size);
export const verticalScale = (size: number) =>
  Math.round((height / guidelineBaseHeight) * size);
export const moderateScale = (size: number, factor = 0.5) =>
  Math.round(size + (scale(size) - size) * factor);
