// Hooks
import { useApptheme } from "@/lib/context/theme.context";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

export default function UpdateScheduleBtn({
  onHandlerSubmit,
  isUpatingSchedule,
}: {
  onHandlerSubmit: () => Promise<void>;
  isUpatingSchedule: boolean;
}) {
  const { appTheme } = useApptheme();
  const { t } = useTranslation();

  return (
    <View className="w-full px-4 pb-4 pt-3">
      <TouchableOpacity
        accessibilityRole="button"
        disabled={isUpatingSchedule}
        onPress={onHandlerSubmit}
        className="h-12 w-full items-center justify-center rounded-lg"
        style={{
          backgroundColor: appTheme.fontMainColor,
          opacity: isUpatingSchedule ? 0.7 : 1,
        }}
      >
        {isUpatingSchedule ? (
          <ActivityIndicator color={appTheme.themeBackground} />
        ) : (
          <Text
            className="text-base font-semibold"
            style={{ color: appTheme.themeBackground }}
          >
            {t("saveBtn")}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
