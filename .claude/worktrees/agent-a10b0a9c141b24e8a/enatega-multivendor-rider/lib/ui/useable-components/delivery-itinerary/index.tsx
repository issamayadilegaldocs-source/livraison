import React from "react";
import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { useApptheme } from "@/lib/context/global/theme.context";

interface DeliveryItineraryProps {
  restaurantName: string;
  deliveryAddress: string;
  etaToRestaurant: number | null;
  distanceToRestaurant: number | null;
  etaToCustomer: number | null;
  distanceToCustomer: number | null;
  orderStatus: string;
}

function formatEta(minutes: number | null): string {
  if (minutes === null) return "—";
  const m = Math.round(minutes);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}min`;
}

function formatDist(km: number | null): string {
  if (km === null) return "";
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

export default function DeliveryItinerary({
  restaurantName,
  deliveryAddress,
  etaToRestaurant,
  distanceToRestaurant,
  etaToCustomer,
  distanceToCustomer,
  orderStatus,
}: DeliveryItineraryProps) {
  const { t } = useTranslation();
  const { appTheme } = useApptheme();

  const isPicked = orderStatus === "PICKED" || orderStatus === "ARRIVED";
  const isDelivered = orderStatus === "DELIVERED";

  const legLabel = (eta: number | null, dist: number | null) => {
    const parts = [formatEta(eta), formatDist(dist)].filter(Boolean);
    return parts.join(" · ");
  };

  return (
    <View style={{ marginBottom: 16 }}>
      {/* Rider dot */}
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        <View style={{ alignItems: "center", width: 14 }}>
          <View
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: appTheme.primary,
              marginTop: 2,
            }}
          />
        </View>
        <Text
          style={{ fontSize: 13, fontWeight: "600", color: appTheme.fontSecondColor }}
        >
          {t("You (Rider)")}
        </Text>
      </View>

      {/* Leg 1: Rider → Restaurant */}
      <View style={{ flexDirection: "row", alignItems: "stretch" }}>
        <View style={{ alignItems: "center", width: 14 }}>
          <View
            style={{
              width: 2,
              flex: 1,
              backgroundColor: isPicked || isDelivered ? "#10B981" : appTheme.primary,
              marginVertical: 2,
            }}
          />
        </View>
        <View style={{ flex: 1, paddingLeft: 12, paddingVertical: 4 }}>
          {!isPicked && !isDelivered && (
            <Text
              style={{ fontSize: 11, color: appTheme.fontSecondColor }}
            >
              {legLabel(etaToRestaurant, distanceToRestaurant)}
            </Text>
          )}
        </View>
      </View>

      {/* Restaurant dot */}
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        <View style={{ alignItems: "center", width: 14 }}>
          {isPicked || isDelivered ? (
            <View
              style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: "#10B981",
                alignItems: "center",
                justifyContent: "center",
                marginTop: 2,
              }}
            >
              <Text style={{ color: "white", fontSize: 8, fontWeight: "900" }}>✓</Text>
            </View>
          ) : (
            <View
              style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                borderWidth: 2,
                borderColor: appTheme.primary,
                backgroundColor: appTheme.themeBackground,
                marginTop: 2,
              }}
            />
          )}
        </View>
        <Text
          style={{
            fontSize: 13,
            fontWeight: isPicked ? "400" : "700",
            color: isPicked ? appTheme.fontSecondColor : appTheme.fontMainColor,
          }}
        >
          {restaurantName}
        </Text>
      </View>

      {/* Leg 2: Restaurant → Customer */}
      <View style={{ flexDirection: "row", alignItems: "stretch" }}>
        <View style={{ alignItems: "center", width: 14 }}>
          <View
            style={{
              width: 2,
              flex: 1,
              backgroundColor: isDelivered ? "#10B981" : "#D1D5DB",
              marginVertical: 2,
            }}
          />
        </View>
        <View style={{ flex: 1, paddingLeft: 12, paddingVertical: 4 }}>
          {isPicked && !isDelivered && (
            <Text style={{ fontSize: 11, color: appTheme.fontSecondColor }}>
              {legLabel(etaToCustomer, distanceToCustomer)}
            </Text>
          )}
        </View>
      </View>

      {/* Delivery dot */}
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        <View style={{ alignItems: "center", width: 14 }}>
          {isDelivered ? (
            <View
              style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: "#10B981",
                alignItems: "center",
                justifyContent: "center",
                marginTop: 2,
              }}
            >
              <Text style={{ color: "white", fontSize: 8, fontWeight: "900" }}>✓</Text>
            </View>
          ) : (
            <View
              style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                borderWidth: 2,
                borderColor: isPicked ? "#10B981" : "#D1D5DB",
                backgroundColor: appTheme.themeBackground,
                marginTop: 2,
              }}
            />
          )}
        </View>
        <Text
          style={{
            fontSize: 13,
            fontWeight: isPicked ? "700" : "400",
            color: isPicked ? appTheme.fontMainColor : appTheme.fontSecondColor,
          }}
          numberOfLines={2}
        >
          {deliveryAddress}
        </Text>
      </View>
    </View>
  );
}
