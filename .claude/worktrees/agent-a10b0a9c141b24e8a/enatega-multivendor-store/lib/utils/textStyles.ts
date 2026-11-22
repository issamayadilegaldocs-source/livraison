import { TextStyle } from "react-native";
import { scale } from "./scaling";

// Ported from the customer app. The store does not bundle the MuseoSans font
// family, so weight variants map to system fontWeight instead of fontFamily.
export const textStyles: Record<string, TextStyle> = {
  H1: { fontSize: scale(35) },
  H2: { fontSize: scale(24) },
  H3: { fontSize: scale(20) },
  H4: { fontSize: scale(16) },
  H5: { fontSize: scale(14) },
  Normal: { fontSize: scale(12) },
  Small: { fontSize: scale(10) },
  Smaller: { fontSize: scale(8) },
  Regular: { fontWeight: "400" },
  Bold: { fontWeight: "600" },
  Bolder: { fontWeight: "700" },
  Center: { textAlign: "center" },
  Right: { textAlign: "right" },
  Left: { textAlign: "left" },
  UpperCase: { textTransform: "uppercase" },
  LineOver: { textDecorationLine: "line-through" },
  B700: { fontWeight: "700" },
  TextItalic: { fontStyle: "italic" },
};
