import { useTranslation } from "react-i18next";

import { useApptheme } from "@/lib/context/theme.context";
import { theme, AuthThemeValue, AuthTheme } from "@/lib/utils/themeColors";

/**
 * Bridges the store's theme context (light | dark) to the customer app's
 * auth theme palette (Pink | Dark) so the ported auth screens can keep their
 * original StyleSheet styling and `currentTheme` / `themeContext` API.
 */
export const useAuthTheme = () => {
  const { i18n } = useTranslation();
  const { currentTheme: mode } = useApptheme();

  const ThemeValue: AuthThemeValue = mode === "dark" ? "Dark" : "Pink";
  const currentTheme: AuthTheme = {
    isRTL: i18n.dir() === "rtl",
    ...theme[ThemeValue],
  };

  return { currentTheme, themeContext: { ThemeValue } };
};
