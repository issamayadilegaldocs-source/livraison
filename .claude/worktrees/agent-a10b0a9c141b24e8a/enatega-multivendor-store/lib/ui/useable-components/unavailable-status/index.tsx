import { useUserContext } from "@/lib/context/global/user.context";
import { useApptheme } from "@/lib/context/theme.context";
import { usePathname } from "expo-router";
import { isBoolean } from "lodash";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
export default function UnavailableStatus() {
  // Hooks
  const { t } = useTranslation();
  const { appTheme } = useApptheme();
  const pathName = usePathname();
  const { dataProfile } = useUserContext();
  const insets = useSafeAreaInsets();

  // States
  const [isAvailable, setIsAvailable] = useState(true);

  // UseEffects
  useEffect(() => {
    if (!isBoolean(dataProfile?.isAvailable)) return;
    setIsAvailable(dataProfile?.isAvailable);
  }, [dataProfile?.isAvailable]);

  if (pathName === "/login") return null;
  if (!isBoolean(isAvailable)) return null;
  if (isAvailable) return null;

  return (
    <View
      style={{
        backgroundColor: appTheme.black,
        paddingTop: insets.top + 4, // Sits below the notch / status bar
        paddingHorizontal: 16,
        paddingBottom: 6,
        width: "100%",
      }}
    >
      <Text style={{ color: "white", textAlign: "center", fontWeight: "bold" }}>
        {t("youAreCurrentlyUnavailable")}.
      </Text>
    </View>
  );
}
