// Core
import { StyleSheet, Text, View } from "react-native";

// Hooks
import { useApptheme } from "@/lib/context/theme.context";
import { WorkSchedule } from "@/lib/utils/interfaces";
import { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { TouchableOpacity } from "react-native";
import { Switch } from "react-native-switch";

export default function WorkScheduleStack({
  item,
  index,
  toggleDay,
  removeSlot,
  addSlot,
  toggleFullDay,
  dropdown,
  setDropdown,
  isTogglingDay,
}: {
  item: WorkSchedule;
  index: number;
  toggleDay: (index: number) => void;
  removeSlot: (index: number, slotIndex: number) => void;
  addSlot: (index: number) => void;
  toggleFullDay: (index: number) => void;
  dropdown: {
    dayIndex: number;
    slotIndex: number;
    type: "start" | "end";
  } | null;
  setDropdown: Dispatch<
    SetStateAction<{
      dayIndex: number;
      slotIndex: number;
      type: "start" | "end";
    } | null>
  >;
  isTogglingDay: number;
}) {
  // Hooks
  const { appTheme } = useApptheme();
  const { t } = useTranslation();
  const isOpen = item.times.length > 0;
  const isFullDay =
    item.times.length === 1 &&
    item.times[0].startTime.join(":") === "00:00" &&
    item.times[0].endTime.join(":") === "23:59";

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={() => setDropdown(null)}
      className="mb-3 rounded-xl border p-4"
      style={{
        backgroundColor: appTheme.themeBackground,
        borderColor: appTheme.borderLineColor,
      }}
    >
      {/* Day Header with Toggle */}
      <View className="flex-row items-center">
        <Switch
          value={isOpen}
          onValueChange={() => toggleDay(index)}
          activeText={""}
          inActiveText={""}
          circleSize={25}
          barHeight={25}
          backgroundActive={appTheme.primary}
          backgroundInactive={appTheme.gray}
          circleBorderWidth={0}
          disabled={isTogglingDay !== index && isTogglingDay !== -1}
        />
        <Text
          className="ml-3 w-12 text-sm font-semibold"
          style={{ color: appTheme.fontMainColor }}
        >
          {t(item.day)}
        </Text>

        <View className="flex-1" />

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ selected: isFullDay }}
          onPress={() => toggleFullDay(index)}
          className="h-9 items-center justify-center rounded-lg border px-3"
          style={{
            backgroundColor: isFullDay
              ? appTheme.primary
              : appTheme.themeBackground,
            borderColor: isFullDay
              ? appTheme.primary
              : appTheme.borderLineColor,
          }}
        >
          <Text
            className="text-xs font-bold"
            style={{
              color: isFullDay ? appTheme.black : appTheme.fontMainColor,
            }}
          >
            24h
          </Text>
        </TouchableOpacity>
      </View>

      {/* Time Slots */}
      {isOpen ? (
        <View className="mt-3">
          {isFullDay ? (
            <View
              className="self-start rounded-full px-3 py-1"
              style={{ backgroundColor: appTheme.lowOpacityPrimaryColor }}
            >
              <Text
                className="text-xs font-semibold"
                style={{ color: appTheme.fontMainColor }}
              >
                {t("Full day")}
              </Text>
            </View>
          ) : null}

          {!isFullDay &&
            item.times.map((slot, slotIndex) => {
              const isStartTapped =
                dropdown?.dayIndex === index &&
                dropdown?.slotIndex === slotIndex &&
                dropdown?.type === "start";
              const isEndTapped =
                dropdown?.dayIndex === index &&
                dropdown?.slotIndex === slotIndex &&
                dropdown?.type === "end";

              return (
                <View
                  key={slotIndex}
                  className="mt-2 flex-row items-center gap-x-2"
                >
                  {/* Start Time Button */}
                  <TouchableOpacity
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    onPress={() =>
                      setDropdown({
                        dayIndex: index,
                        slotIndex,
                        type: "start",
                      })
                    }
                    className="h-11 flex-1 justify-center rounded-lg px-2"
                    style={[
                      isStartTapped ? style.tappedSlot : style.slot,
                      { backgroundColor: appTheme.themeBackground },
                    ]}
                  >
                    <Text
                      className="text-center"
                      style={{ color: appTheme.fontMainColor }}
                    >
                      {slot.startTime.join(":")}
                    </Text>
                  </TouchableOpacity>

                  <Text style={{ color: appTheme.fontSecondColor }}>-</Text>

                  {/* End Time Button */}
                  <TouchableOpacity
                    onPress={() =>
                      setDropdown({
                        dayIndex: index,
                        slotIndex,
                        type: "end",
                      })
                    }
                    className="h-11 flex-1 justify-center rounded-lg px-2"
                    style={[
                      isEndTapped ? style.tappedSlot : style.slot,
                      { backgroundColor: appTheme.themeBackground },
                    ]}
                  >
                    <Text
                      className="text-center"
                      style={{ color: appTheme.fontMainColor }}
                    >
                      {slot.endTime.join(":")}
                    </Text>
                  </TouchableOpacity>

                  {/* Remove Slot Button */}
                  {item.times.length > 1 && slotIndex !== 0 && (
                    <TouchableOpacity
                      onPress={() => removeSlot(index, slotIndex)}
                      className="h-8 w-8 items-center justify-center rounded-full border"
                      style={{
                        borderColor: "#dc2626",
                      }}
                    >
                      <Text style={{ color: "#dc2626" }} className="font-bold">
                        −
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Add Slot Button */}
                  {slotIndex === 0 && (
                    <TouchableOpacity
                      onPress={() => addSlot(index)}
                      className="h-8 w-8 items-center justify-center rounded-full border"
                      style={{
                        backgroundColor: appTheme.themeBackground,
                        borderColor: appTheme.primary,
                      }}
                    >
                      <Text
                        className=" font-bold text-center"
                        style={{ color: appTheme.primary }}
                      >
                        +
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
        </View>
      ) : (
        <View className="mt-3 self-start rounded-full bg-black px-3 py-1">
          <Text className="text-xs font-medium text-white">
            {t("Closed all Day")}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
const style = StyleSheet.create({
  slot: {
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  tappedSlot: {
    borderWidth: 1,
    borderColor: "#22c55e",
  },
});
