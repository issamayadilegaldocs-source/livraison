import { useLocalSearchParams, useRouter } from "expo-router";
import { useContext } from "react";
import {
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "@apollo/client";
import { useTranslation } from "react-i18next";

import { useApptheme } from "@/lib/context/theme.context";
import RestaurantProvider from "@/lib/context/global/restaurant";
import { ConfigurationContext } from "@/lib/context/global/configuration.context";
import { IOrder, Item } from "@/lib/utils/interfaces/order.interface";
import { MARK_ORDER_PREPARED } from "@/lib/api/graphql/mutation/order";

const STATUS_COLOR: Record<string, string> = {
  PENDING: "#F59E0B",
  ACCEPTED: "#3B82F6",
  PREPARED: "#8B5CF6",
  AWAITING_RIDER: "#06B6D4",
  ASSIGNED: "#10B981",
  PICKED: "#6366F1",
  DELIVERED: "#059669",
  CANCELLED: "#EF4444",
};

export default function OrderDetailScreen() {
  const { appTheme } = useApptheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const configuration = useContext(ConfigurationContext);
  const { data } = useContext(RestaurantProvider.Context);

  const order: IOrder | undefined = (data?.restaurantOrders ?? []).find(
    (o: IOrder) => o._id === id
  );

  const [markPrepared, { loading: preparing }] = useMutation(MARK_ORDER_PREPARED, {
    onError: (e) => Alert.alert("Erreur", e.message),
  });

  const currency = configuration?.currencySymbol ?? "DT";

  const itemTotal =
    order?.items?.reduce(
      (sum: number, item: Item) =>
        sum + (item.variation?.price ?? 0) * (item.quantity ?? 1),
      0
    ) ?? 0;

  if (!order) {
    return (
      <SafeAreaView
        style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: appTheme.themeBackground }}
      >
        <ActivityIndicator color={appTheme.primary} size="large" />
        <Text style={{ color: appTheme.fontSecondColor, marginTop: 12 }}>
          {t("Loading")}…
        </Text>
      </SafeAreaView>
    );
  }

  const statusColor = STATUS_COLOR[order.orderStatus ?? ""] ?? appTheme.primary;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: appTheme.themeBackground }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: appTheme.borderLineColor,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          style={{ marginRight: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color={appTheme.fontMainColor} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 17, fontWeight: "700", color: appTheme.fontMainColor }}>
          {t("Order")} #{order.orderId}
        </Text>
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 20,
            backgroundColor: statusColor + "22",
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "700", color: statusColor }}>
            {order.orderStatus}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        {/* Customer */}
        <View
          style={{
            borderRadius: 12,
            borderWidth: 1,
            borderColor: appTheme.borderLineColor,
            padding: 14,
            marginBottom: 14,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "700", color: appTheme.fontSecondColor, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
            {t("Customer")}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: appTheme.primary + "22",
                justifyContent: "center", alignItems: "center",
              }}
            >
              <Ionicons name="person-outline" size={20} color={appTheme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: appTheme.fontMainColor }}>
                {order.user?.name ?? "—"}
              </Text>
              {order.user?.phone ? (
                <Text style={{ fontSize: 13, color: appTheme.fontSecondColor }}>{order.user.phone}</Text>
              ) : null}
            </View>
          </View>
          {order.deliveryAddress?.deliveryAddress ? (
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 10 }}>
              <Ionicons name="location-outline" size={16} color={appTheme.fontSecondColor} style={{ marginTop: 2 }} />
              <Text style={{ flex: 1, fontSize: 13, color: appTheme.fontSecondColor }}>
                {order.deliveryAddress.deliveryAddress}
              </Text>
            </View>
          ) : null}
          {order.paymentMethod ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
              <Ionicons name="card-outline" size={16} color={appTheme.fontSecondColor} />
              <Text style={{ fontSize: 13, color: appTheme.fontSecondColor }}>
                {order.paymentMethod === "COD" ? "Paiement à la livraison" : order.paymentMethod}
              </Text>
            </View>
          ) : null}
          {order.instructions ? (
            <View style={{ marginTop: 10, padding: 10, borderRadius: 8, backgroundColor: "#FEF3C7" }}>
              <Text style={{ fontSize: 12, color: "#92400E", fontWeight: "600" }}>Instructions :</Text>
              <Text style={{ fontSize: 13, color: "#78350F", marginTop: 2 }}>{order.instructions}</Text>
            </View>
          ) : null}
        </View>

        {/* Items */}
        <View
          style={{
            borderRadius: 12, borderWidth: 1,
            borderColor: appTheme.borderLineColor,
            padding: 14, marginBottom: 14,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "700", color: appTheme.fontSecondColor, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
            {t("Menu")}
          </Text>
          {(order.items ?? []).map((item: Item) => (
            <View
              key={item._id}
              style={{
                flexDirection: "row", justifyContent: "space-between",
                alignItems: "flex-start", paddingVertical: 8,
                borderBottomWidth: 1, borderBottomColor: appTheme.borderLineColor + "44",
              }}
            >
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: appTheme.fontMainColor }}>
                  {item.title}
                </Text>
                {item.addons?.length ? (
                  <Text style={{ fontSize: 11, color: appTheme.fontSecondColor, marginTop: 3 }}>
                    + {item.addons.flatMap((a) => a.options?.map((o) => o.title) ?? []).join(", ")}
                  </Text>
                ) : null}
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: appTheme.fontMainColor }}>
                  {currency} {((item.variation?.price ?? 0) * (item.quantity ?? 1)).toFixed(2)}
                </Text>
                <Text style={{ fontSize: 12, color: appTheme.fontSecondColor }}>x{item.quantity ?? 1}</Text>
              </View>
            </View>
          ))}

          {/* Totals */}
          <View style={{ marginTop: 12 }}>
            {[
              { label: "Sous-total", value: itemTotal },
              { label: "Livraison", value: order.deliveryCharges ?? 0 },
              { label: "TVA", value: order.taxationAmount ?? 0 },
              { label: "Pourboire", value: order.tipping ?? 0 },
            ]
              .filter((r) => r.value > 0)
              .map((r) => (
                <View key={r.label} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                  <Text style={{ fontSize: 14, color: appTheme.fontSecondColor }}>{r.label}</Text>
                  <Text style={{ fontSize: 14, color: appTheme.fontMainColor }}>{currency} {r.value.toFixed(2)}</Text>
                </View>
              ))}
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: 10, borderTopWidth: 1, borderTopColor: appTheme.borderLineColor }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: appTheme.fontMainColor }}>Total</Text>
              <Text style={{ fontSize: 16, fontWeight: "700", color: appTheme.primary }}>
                {currency} {(order.orderAmount ?? itemTotal).toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {/* Rider (if assigned) */}
        {order.rider ? (
          <View style={{ borderRadius: 12, borderWidth: 1, borderColor: appTheme.borderLineColor, padding: 14, marginBottom: 14 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: appTheme.fontSecondColor, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Livreur
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Ionicons name="bicycle-outline" size={24} color={appTheme.primary} />
              <Text style={{ fontSize: 15, fontWeight: "600", color: appTheme.fontMainColor }}>
                {order.rider.name}
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Action: Mark Prepared */}
      {order.orderStatus === "ACCEPTED" && (
        <View
          style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            padding: 16, paddingBottom: 34,
            backgroundColor: appTheme.themeBackground,
            borderTopWidth: 1, borderTopColor: appTheme.borderLineColor,
          }}
        >
          <TouchableOpacity
            onPress={() => markPrepared({ variables: { _id: order._id } })}
            disabled={preparing}
            accessibilityRole="button"
            accessibilityLabel="Marquer comme prête"
            style={{ backgroundColor: appTheme.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center" }}
          >
            {preparing ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={{ color: "white", fontSize: 16, fontWeight: "700" }}>
                ✓ Marquer comme prête
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}
