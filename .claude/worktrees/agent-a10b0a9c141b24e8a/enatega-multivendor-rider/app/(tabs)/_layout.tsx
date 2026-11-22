import { Tabs, usePathname } from "expo-router";
import { Platform, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@apollo/client";
import { MY_UNREAD_COUNT } from "@/lib/apollo/queries/notifications.query";

// UI Components
import { HapticTab } from "@/lib/ui/useable-components/HapticTab";
import {
  CurrencyIcon,
  HomeIcon,
  PersonIcon,
  WalletIcon,
} from "@/lib/ui/useable-components/svg";

// Hooks
import { useApptheme } from "@/lib/context/global/theme.context";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const RootLayout = () => {
  // States
  const [tabKey, setTabKey] = useState(1);

  // Hooks
  const pathName = usePathname();
  const { t } = useTranslation();
  const { appTheme } = useApptheme();

  const { data: unreadData } = useQuery(MY_UNREAD_COUNT, {
    fetchPolicy: "cache-and-network",
    pollInterval: 30000,
  });
  const unreadCount: number = unreadData?.myUnreadNotificationsCount ?? 0;

  useEffect(() => {
    if (pathName.startsWith("/wallet/success")) {
      setTabKey((prev) => prev + 1);
    }
  }, [pathName]);

  return (
    <Tabs
      key={tabKey}
      screenOptions={{
        tabBarActiveTintColor: appTheme.primary,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: Platform.select({
          ios: {
            position: "absolute",
            backgroundColor: "#1F2937",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderTopWidth: 0.5,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -5 },
            shadowOpacity: 0.1,
            shadowRadius: 5,
          },
          android: {
            position: "absolute",
            backgroundColor: "#1F2937",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderTopWidth: 0.5,
            elevation: 5,
            shadowOffset: { width: 0, height: -5 },
            shadowOpacity: 0.1,
            shadowRadius: 5,
          },
        }),
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          href: "/(tabs)/home/orders",
          title: t("Home"),
          tabBarIcon: ({ color }) => (
            <HomeIcon color={color} width={25} height={25} />
          ),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          href: "/(tabs)/wallet",
          title: t("Wallet"),
          tabBarIcon: ({ color }) => (
            <WalletIcon color={color} width={25} height={25} />
          ),
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          href: "/(tabs)/earnings",
          title: t("Earnings"),
          tabBarIcon: ({ color }) => (
            <CurrencyIcon color={color} width={25} height={25} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          href: "/(tabs)/notifications",
          title: t("Notifications"),
          tabBarIcon: ({ color }) => (
            <View style={{ width: 25, height: 25, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="notifications-outline" size={25} color={color} />
              {unreadCount > 0 && (
                <View
                  style={{
                    position: "absolute",
                    top: -2,
                    right: -4,
                    backgroundColor: "#EF4444",
                    borderRadius: 8,
                    minWidth: 16,
                    height: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 3,
                  }}
                >
                  <Ionicons name="ellipse" size={8} color="#fff" />
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: "/(tabs)/profile",
          title: t("Profile"),
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <PersonIcon color={color} width={25} height={25} />
          ),
        }}
      />
    </Tabs>
  );
};

export default RootLayout;
