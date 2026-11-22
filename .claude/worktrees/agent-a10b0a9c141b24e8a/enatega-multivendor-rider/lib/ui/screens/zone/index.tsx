import { useQuery } from "@apollo/client";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Polygon, PROVIDER_GOOGLE } from "react-native-maps";
import { useTranslation } from "react-i18next";
import { useApptheme } from "@/lib/context/global/theme.context";
import { useUserContext } from "@/lib/context/global/user.context";
import { GET_ZONE_BY_ID } from "@/lib/apollo/queries/zone.query";

export default function ZoneScreen() {
  const { appTheme } = useApptheme();
  const { t } = useTranslation();
  const { dataProfile, refetchProfile } = useUserContext();
  const zoneId = dataProfile?.zone?._id;

  useFocusEffect(
    useCallback(() => {
      refetchProfile().catch(() => undefined);
    }, [refetchProfile]),
  );

  const { data, loading, error } = useQuery(GET_ZONE_BY_ID, {
    variables: { id: zoneId },
    skip: !zoneId,
    fetchPolicy: "cache-and-network",
  });

  const zone = data?.zoneById;

  // GeoJSON polygon: coordinates[0] is the outer ring — array of [lng, lat]
  const rawCoords: [number, number][][] = zone?.location?.coordinates ?? [];
  const outerRing: [number, number][] = rawCoords[0] ?? [];

  const polygonCoords = outerRing.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));

  // Compute bounding box center for initial map region
  const center =
    polygonCoords.length > 0
      ? polygonCoords.reduce(
          (acc, c) => ({ latitude: acc.latitude + c.latitude / polygonCoords.length, longitude: acc.longitude + c.longitude / polygonCoords.length }),
          { latitude: 0, longitude: 0 }
        )
      : { latitude: 36.8, longitude: 10.18 }; // Tunisia default

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: appTheme.themeBackground }}>
      {/* Zone info header */}
      <View style={{ padding: 16, borderBottomWidth: 1, borderColor: appTheme.borderLineColor }}>
        {zone ? (
          <>
            <Text style={{ color: appTheme.mainTextColor, fontSize: 18, fontWeight: "700" }}>{zone.title}</Text>
            {zone.description ? <Text style={{ color: appTheme.secondaryTextColor, fontSize: 13, marginTop: 4 }}>{zone.description}</Text> : null}
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: zone.isActive ? "#22C55E" : "#EF4444", marginRight: 6 }} />
              <Text style={{ color: appTheme.secondaryTextColor, fontSize: 12 }}>{zone.isActive ? (t("Active") || "Active") : (t("Inactive") || "Inactive")}</Text>
            </View>
          </>
        ) : loading ? (
          <Text style={{ color: appTheme.secondaryTextColor }}>{t("Loading")}...</Text>
        ) : !zoneId ? (
          <Text style={{ color: appTheme.secondaryTextColor }}>{t("noZoneAssigned") || "Aucune zone assignée à votre compte."}</Text>
        ) : null}
      </View>

      {/* Map */}
      {loading && !zone ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={appTheme.primary} />
        </View>
      ) : error || !zone ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
          <Text style={{ color: appTheme.secondaryTextColor, textAlign: "center" }}>
            {error ? error.message : (t("noZoneData") || "Aucune donnée de zone disponible.")}
          </Text>
        </View>
      ) : (
        <MapView
          style={{ flex: 1 }}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            ...center,
            latitudeDelta: 0.15,
            longitudeDelta: 0.15,
          }}
          accessibilityLabel={t("zoneMap") || "Zone map"}
        >
          {polygonCoords.length > 0 && (
            <Polygon
              coordinates={polygonCoords}
              strokeColor={appTheme.primary}
              fillColor={appTheme.primary + "33"}
              strokeWidth={2}
            />
          )}
        </MapView>
      )}
    </SafeAreaView>
  );
}
