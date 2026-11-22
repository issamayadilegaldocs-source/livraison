import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { UPDATE_AVAILABILITY } from "@/lib/apollo/mutations/rider.mutation";
import { RIDER_PROFILE } from "@/lib/apollo/queries";
import { GET_ZONE_BY_POINT } from "@/lib/apollo/queries/zone.query";
import { useApptheme } from "@/lib/context/global/theme.context";
import { useLocationContext } from "@/lib/context/global/location.context";
import { useUserContext } from "@/lib/context/global/user.context";
import SpinnerComponent from "@/lib/ui/useable-components/spinner";
import CustomSwitch from "@/lib/ui/useable-components/switch-button";
import {
  ApolloError,
  MutationTuple,
  useMutation,
  useQuery,
} from "@apollo/client";
import { useEffect, useState } from "react";
import { showMessage } from "react-native-flash-message";

const CustomDrawerHeader = () => {
  // Hook
  const { appTheme } = useApptheme();
  const { t } = useTranslation();
  const { dataProfile, loadingProfile } = useUserContext();
  const { location } = useLocationContext();
  const [isRiderAvailable, setIsRiderAvailable] = useState(false);

  // Resolve the admin-defined zone the rider is currently standing in
  const latitude = location?.latitude ? Number(location.latitude) : undefined;
  const longitude = location?.longitude
    ? Number(location.longitude)
    : undefined;
  const hasCoords =
    typeof latitude === "number" &&
    !Number.isNaN(latitude) &&
    typeof longitude === "number" &&
    !Number.isNaN(longitude);

  const { data: zoneData } = useQuery(GET_ZONE_BY_POINT, {
    variables: { latitude, longitude },
    skip: !hasCoords,
    fetchPolicy: "cache-and-network",
  });
  const currentZoneTitle = zoneData?.zoneByPoint?.title as string | undefined;

  // Keep the local (optimistic) state in sync with the server value
  useEffect(() => {
    setIsRiderAvailable(dataProfile?.available ?? false);
  }, [dataProfile?.available]);

  // Mutation
  const [toggleAvailablity, { loading }] = useMutation(UPDATE_AVAILABILITY, {
    refetchQueries: [{ query: RIDER_PROFILE }],
    awaitRefetchQueries: true,
  }) as MutationTuple<boolean, { available: boolean }>;

  const onToggleAvailability = async (newValue: boolean) => {
    if (!dataProfile?._id?.toString()) {
      showMessage({ message: t("User ID is missing"), type: "danger" });
      return;
    }

    // Optimistic update so the switch reacts immediately
    setIsRiderAvailable(newValue);
    try {
      await toggleAvailablity({ variables: { available: newValue } });
    } catch (error) {
      // Revert on failure and surface the error to the rider
      setIsRiderAvailable(!newValue);
      const message =
        (error as ApolloError)?.graphQLErrors?.[0]?.message ??
        (error as Error)?.message ??
        t("Failed to update availability");
      showMessage({ message, type: "danger" });
    }
  };

  return (
    <View
      className={` w-full h-[15%] flex-row justify-between p-3 pt-6 top-0 bottom-4`}
      style={{ backgroundColor: appTheme.primary }}
    >
      <View className="justify-between flex-1">
        <View
          className="w-[32px] h-[32px] rounded-full items-center justify-center overflow-hidden"
          style={{ backgroundColor: appTheme.white }}
        >
          <Text
            className="text-[16px] font-semibold"
            style={{
              color: appTheme.primary,
            }}
          >
            {dataProfile?.name
              ?.split(" ")[0]
              ?.substring(0, 1)
              ?.toUpperCase()
              ?.concat(
                "",
                dataProfile?.name?.split(" ")[1]?.length
                  ? (dataProfile?.name
                      ?.split(" ")[1]
                      ?.substring(0, 1)
                      ?.toUpperCase() ?? "")
                  : ""
              ) ?? "JS"}
          </Text>
        </View>
        <View className="flex-1 pr-2">
          <Text
            className="font-semibold text-[16px]"
            style={{
              color: appTheme.black,
            }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {dataProfile?.name ?? t("riderName")}
          </Text>
          <Text
            className="font-medium"
            style={{
              color: appTheme.secondaryTextColor,
            }}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {dataProfile?._id.substring(0, 9).toUpperCase() ?? "rider id"}{" "}
          </Text>
          {currentZoneTitle ? (
            <Text
              className="text-xs font-medium mt-0.5"
              style={{ color: appTheme.secondaryTextColor }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              📍 {currentZoneTitle}
            </Text>
          ) : null}
        </View>
      </View>

      <View className="items-end justify-end gap-2">
        <Text
          className="text-md"
          style={{ color: appTheme.secondaryTextColor }}
        >
          {t("Availability")}
        </Text>
        {loadingProfile && !dataProfile ? (
          <SpinnerComponent color={appTheme.secondaryTextColor} />
        ) : (
          <CustomSwitch
            value={isRiderAvailable}
            isDisabled={loading}
            onToggle={onToggleAvailability}
          />
        )}

        <Text
          className="text-xs font-medium"
          style={{ color: appTheme.secondaryTextColor }}
        >
          {isRiderAvailable ? t("Available") : t("notAvailable")}
        </Text>
      </View>
    </View>
  );
};

export default CustomDrawerHeader;
