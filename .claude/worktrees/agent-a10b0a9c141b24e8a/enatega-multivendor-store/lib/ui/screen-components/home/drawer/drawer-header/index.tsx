import { UPDATE_AVAILABILITY } from "@/lib/apollo/mutations/rider.mutation";
import { STORE_PROFILE } from "@/lib/apollo/queries";
import { useUserContext } from "@/lib/context/global/user.context";
import { useApptheme } from "@/lib/context/theme.context";
import SpinnerComponent from "@/lib/ui/useable-components/spinner";
import CustomSwitch from "@/lib/ui/useable-components/switch-button";
import { IStoreProfile } from "@/lib/utils/interfaces";
import { MutationTuple, useMutation } from "@apollo/client";
import { useTranslation } from "react-i18next";
import { Alert, Image, Text, View } from "react-native";
import { showMessage } from "react-native-flash-message";

const CustomDrawerHeader = () => {
  // Hooks
  const { appTheme } = useApptheme();
  const { t } = useTranslation();
  const { dataProfile, userId, refetchProfile, loadingProfile } = useUserContext();

  // Queries
  const [toggleAvailablity, { loading }] = useMutation(UPDATE_AVAILABILITY, {
    refetchQueries: [
      { query: STORE_PROFILE, variables: { restaurantId: userId } },
    ],
    onCompleted: (data) => {
      if (refetchProfile) {
        refetchProfile();
      }
    },
    onError: (error) => {
      showMessage({
        message:
          error?.graphQLErrors[0]?.message ||
          error?.networkError?.message ||
          error?.networkError?.message ||
          t("Unable to update availability"),
      });
    },
  }) as MutationTuple<
    IStoreProfile | undefined,
    { pauseMinutes?: number }
  >;

  // Handlers
  async function pause(pauseMinutes?: number) {
    try {
      await toggleAvailablity({ variables: { pauseMinutes } });
    } catch (error) {
      console.error("error while toggling availability", error);
    }
  }

  // A store is available by default: only an explicit pause (isAvailable ===
  // false) takes it offline. undefined/null (legacy docs that predate the
  // field) must read as available, matching the backend order gate which only
  // blocks when isAvailable === false.
  const isAvailable = dataProfile?.isAvailable !== false;

  function handleToggleAvailability() {
    // Turning availability back ON — no prompt needed.
    if (!isAvailable) {
      pause();
      return;
    }
    // Pausing — ask for how long so the store auto-resumes and doesn't get
    // stuck offline after a busy spell.
    Alert.alert(
      t("Pause new orders"),
      t("Your store will stop receiving orders. When should it reopen?"),
      [
        { text: t("30 minutes"), onPress: () => pause(30) },
        { text: t("1 hour"), onPress: () => pause(60) },
        { text: t("Until I turn it back on"), onPress: () => pause() },
        { text: t("Cancel"), style: "cancel" },
      ],
    );
  }

  return (
    <View
      className="w-full -mt-0 h-[150px] flex-row justify-between p-4 pt-8"
      style={{ backgroundColor: appTheme.primary, marginTop: 1 }}
    >
      <View className="justify-between flex-1">
        <View
          className="w-[54px] h-[54px] rounded-full items-center justify-center overflow-hidden"
          style={{ backgroundColor: appTheme.white }}
        >
          {dataProfile?.logo ? (
        <Image
          source={{ uri: dataProfile.logo }}
          width={100}
          height={100}
          resizeMode="cover"
        />
          ) : (
        <Text
          className="text-[16px] font-semibold"
          style={{
            color: appTheme.primary,
          }}
        >
          {(() => {
            const name = dataProfile?.name;
            if (!name || typeof name !== "string")
          return loadingProfile ? "" : "JS";

            const nameParts = name.split(" ");
            const firstInitial =
          nameParts[0]?.substring(0, 1)?.toUpperCase() || "";
            const secondInitial =
          nameParts[1]?.substring(0, 1)?.toUpperCase() || "";

            return firstInitial + secondInitial || "JS";
          })()}
        </Text>
          )}
        </View>
        <View className="flex-1 pr-2">
          <Text
        className="font-semibold text-[16px]"
        style={{
          color: appTheme.black,
        }}
        numberOfLines={2}
        ellipsizeMode="tail"
          >
        {dataProfile?.name ?? (loadingProfile ? "" : t("storeName"))}
          </Text>
          <Text
        className="font-medium"
        style={{
          color: appTheme.secondaryTextColor,
        }}
          >
        {dataProfile?._id?.substring(0, 9)?.toUpperCase() ??
          (loadingProfile ? "" : t("store id"))}
          </Text>
        </View>
      </View>

      <View className="items-end justify-end gap-2">
        <Text
          className="text-md"
          style={{ color: appTheme.secondaryTextColor }}
        >
          {t("Availability")}
        </Text>
        {loading || loadingProfile ? (
          <SpinnerComponent color={appTheme.secondaryTextColor} height={10} />
        ) : (
          <CustomSwitch
        value={isAvailable}
        isDisabled={loading}
        onToggle={handleToggleAvailability}
          />
        )}
        <Text
          className="text-xs font-medium"
          style={{ color: appTheme.secondaryTextColor }}
        >
          {isAvailable
            ? t("available")
            : dataProfile?.unavailableUntil
              ? t("Paused until {{time}}", {
                  time: new Date(dataProfile.unavailableUntil).toLocaleTimeString(
                    [],
                    { hour: "2-digit", minute: "2-digit" },
                  ),
                })
              : t("notAvailable")}
        </Text>
      </View>
    </View>
  );
};

export default CustomDrawerHeader;
