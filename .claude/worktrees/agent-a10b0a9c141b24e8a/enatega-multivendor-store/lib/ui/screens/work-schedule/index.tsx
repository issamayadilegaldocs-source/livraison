// Core
import { SafeAreaView } from "react-native-safe-area-context";

// Components
import { useApptheme } from "@/lib/context/theme.context";
import WorkScheduleMain from "../../screen-components/work-schedule/view/main";

export default function WorkScheduleScreen() {
  // Hooks
  const { appTheme } = useApptheme();
  return (
    <SafeAreaView
      className="h-full w-full flex-1"
      edges={["top", "right", "bottom", "left"]}
      style={{ backgroundColor: appTheme.themeBackground }}
    >
      <WorkScheduleMain />
    </SafeAreaView>
  );
}
