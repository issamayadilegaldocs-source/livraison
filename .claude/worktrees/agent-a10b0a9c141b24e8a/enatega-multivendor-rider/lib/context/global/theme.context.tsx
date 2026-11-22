// Constants
import { Colors } from "@/lib/utils/constants";

// Interfaces & Types
import { AppThemeContext } from "@/lib/utils/interfaces/app-theme";
import { app_theme } from "@/lib/utils/types/theme";

// React Native AsyncStorage
import AsyncStorage from "@react-native-async-storage/async-storage";

// Hooks
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

// Core
import { Appearance, Platform } from "react-native";

// Context
const ThemeContext = createContext<AppThemeContext>({
  currentTheme: "light",
  toggleTheme: () => {},
  appTheme: Colors.light,
});

export default function AppThemeProvidor({
  children,
}: {
  children: ReactNode;
}) {
  // States — light is the default; dark mode is opt-in via the in-app toggle
  // only (never inherited from the OS color scheme).
  const [currentTheme, setCurrentTheme] = useState<app_theme>("light");
  const [appTheme, setAppTheme] = useState(Colors.light);

  // Methods
  async function getCurrentAppTheme() {
    const localTheme = await AsyncStorage.getItem("app_theme");
    const theme = localTheme || "light";
    // react-native-web's Appearance has no setColorScheme implementation at
    // all — the darkMode:'class' tailwind config (see tailwind.config.js)
    // lets NativeWind's own CSS interop pick up theme changes from state on
    // web instead, so this native-only call is skipped there.
    if (Platform.OS !== "web") {
      Appearance.setColorScheme(theme as app_theme);
    }
    setCurrentTheme(theme as app_theme);
    setAppTheme(
      theme === "light"
        ? Colors.light
        : theme === "dark"
          ? Colors.dark
          : Colors.light,
    );
  }

  // Handlers
  const toggleTheme = useCallback((val: app_theme) => {
    const updatedVal = val === "light" ? "dark" : "light";
    setAppTheme(Colors[updatedVal]);
    setCurrentTheme(updatedVal);
    AsyncStorage.setItem("app_theme", updatedVal);
  }, []);

  useEffect(() => {
    getCurrentAppTheme();
  }, []);

  const contextValue = useMemo(
    () => ({ toggleTheme, currentTheme, appTheme }),
    [toggleTheme, currentTheme, appTheme],
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useApptheme = () => useContext(ThemeContext);
