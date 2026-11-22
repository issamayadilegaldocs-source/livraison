import { useApptheme } from "@/lib/context/global/theme.context";
import { CustomSwitchProps } from "@/lib/utils/interfaces/custom-input-switch";
import { MaterialIcons } from "@expo/vector-icons";
import { TouchableOpacity, View } from "react-native";

const CustomSwitch = ({ value, onToggle, isDisabled }: CustomSwitchProps) => {
  // Hooks
  const { appTheme } = useApptheme();
  return (
    <TouchableOpacity
      disabled={isDisabled}
      className={`flex-row items-center ${isDisabled ? "opacity-35" : ""}`}
      onPress={() => onToggle(!value)}
      activeOpacity={0.8}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!isDisabled }}
      accessibilityLabel="Toggle availability"
    >
      <View
        className="w-16 h-8 rounded-full flex-row items-center px-1"
        style={{
          backgroundColor: value
            ? appTheme.switchButtonColor
            : appTheme.secondaryTextColor,
        }}
      >
        {value ? (
          <View className="ml-auto mr-[1px] bg-white rounded-full h-[20px] w-[20px] items-center justify-center">
            <MaterialIcons
              name="check"
              size={16}
              color={appTheme.switchButtonColor}
            />
          </View>
        ) : (
          <View className="ml-[1px] bg-white rounded-full h-[20px] w-[20px] items-center justify-center">
            <MaterialIcons
              name="close"
              size={16}
              color={appTheme.secondaryTextColor}
            />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

export default CustomSwitch;
