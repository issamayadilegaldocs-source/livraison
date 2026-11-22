import { useContext } from "react";
import { FlatList, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useApptheme } from "@/lib/context/theme.context";
import RestaurantProvider from "@/lib/context/global/restaurant";
import { IOrder } from "@/lib/utils/interfaces/order.interface";

const ACTIVE_STATUSES = ["PENDING", "SCHEDULED", "ACCEPTED", "PREPARED", "AWAITING_RIDER", "ASSIGNED", "PICKED"];

export default function ChatsScreen() {
  const { appTheme } = useApptheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { data, loading } = useContext(RestaurantProvider.Context);

  const orders: IOrder[] = (data?.restaurantOrders ?? []).filter((o: IOrder) =>
    ACTIVE_STATUSES.includes(o.orderStatus ?? "")
  );

  const renderItem = ({ item }: { item: IOrder }) => (
    <TouchableOpacity
      onPress={() =>
        router.push({
          pathname: "/(protected)/chat",
          params: { id: item._id, orderId: item.orderId, phoneNumber: item.user?.phone ?? "" },
        })
      }
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: appTheme.borderLineColor,
        backgroundColor: appTheme.themeBackground,
      }}
      accessibilityRole="button"
      accessibilityLabel={`${t("Chat")} ${t("Order")} #${item.orderId}`}
    >
      <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: appTheme.primary + "22",
            justifyContent: "center",
            alignItems: "center",
            marginRight: 12,
          }}
        >
          <Ionicons name="chatbubble-outline" size={20} color={appTheme.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: appTheme.fontMainColor, fontWeight: "600", fontSize: 14 }}>
            {item.user?.name || t("Customer")}
          </Text>
          <Text style={{ color: appTheme.fontSecondColor, fontSize: 12, marginTop: 2 }}>
            {t("Order")} #{item.orderId} · {item.orderStatus}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={appTheme.fontSecondColor} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: appTheme.themeBackground }}>
      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ color: appTheme.fontSecondColor }}>{t("Loading")}...</Text>
        </View>
      ) : orders.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 }}>
          <Ionicons name="chatbubbles-outline" size={56} color={appTheme.borderLineColor} />
          <Text style={{ color: appTheme.fontSecondColor, fontSize: 16, textAlign: "center", marginTop: 16 }}>
            {t("noActiveOrders") || "No active orders with chat available"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}
    </SafeAreaView>
  );
}
