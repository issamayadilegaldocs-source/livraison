import { useApptheme } from "@/lib/context/theme.context";
import { HapticTab } from "@/lib/ui/useable-components/HapticTab";
import {
  CurrencyIcon,
  HomeIcon,
  PersonIcon,
  WalletIcon,
} from "@/lib/ui/useable-components/svg";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@apollo/client";
import { MY_UNREAD_COUNT } from "@/lib/api/graphql/query/notifications";
import { Tabs, usePathname } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, View } from "react-native";

const RootLayout = () => {
  const [tabKey, setTabKey] = useState(0);
  const pathName = usePathname();
  const { t } = useTranslation();
  const { appTheme } = useApptheme();

  const { data: unreadData } = useQuery(MY_UNREAD_COUNT, {
    fetchPolicy: "cache-and-network",
    pollInterval: 30000,
  });
  const unreadCount: number = unreadData?.myUnreadNotificationsCount ?? 0;

  // Only force a fresh Tabs navigator (via key bump) when returning from the
  // wallet top-up success redirect, to reset navigation state after that
  // deep-link round trip. Bumping the key on every pathname change (as this
  // effect previously did unconditionally) remounts the entire Tabs
  // navigator — every screen, every query subscription — on every single
  // in-app navigation, which is what looked like a full-page refresh on
  // every tab click.
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
        tabBarInactiveTintColor: "#9CA3AF",
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: Platform.select({
          ios: {
            position: "absolute",
            backgroundColor: appTheme.tabNaviatorBackground,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderTopWidth: 0.5,
            shadowColor: appTheme.black,
            shadowOffset: { width: 0, height: -5 },
            shadowOpacity: 0.1,
            shadowRadius: 5,
            zIndex: 0,
          },
          android: {
            position: "absolute",
            backgroundColor: appTheme.tabNaviatorBackground,
            display: pathName.startsWith("/wallet/success") ? "none" : "flex",
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
          href: "/(protected)/(tabs)/home/orders",
          title: t("Home"),
          tabBarIcon: ({ color }) => (
            <HomeIcon
              color={color}
              width={25}
              height={25}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          href: "/(protected)/(tabs)/wallet",
          title: t("Wallet"),
          tabBarIcon: ({ color }) => (
            <WalletIcon
              color={color}
              width={25}
              height={25}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          href: "/(protected)/(tabs)/earnings",
          title: t("Earnings"),
          tabBarIcon: ({ color }) => (
            <CurrencyIcon
              color={color}
              width={25}
              height={25}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          href: "/(protected)/(tabs)/menu",
          headerShown: true,
          headerTitle: t("Menu"),
          headerTitleAlign: "center",
          headerStyle: { backgroundColor: appTheme.themeBackground },
          headerTitleStyle: { color: appTheme.fontMainColor },
          title: t("Menu"),
          tabBarIcon: ({ color }) => (
            <Ionicons name="restaurant-outline" size={25} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          href: "/(protected)/(tabs)/notifications",
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
          href: "/(protected)/(tabs)/profile",
          headerShown: true,
          headerTitle: t("Profile"),
          headerTitleAlign: "center",
          headerStyle: { backgroundColor: appTheme.themeBackground },
          headerTitleStyle: { color: appTheme.fontMainColor },
          title: t("Profile"),
          tabBarIcon: ({ color }) => (
            <PersonIcon
              color={color}
              width={25}
              height={25}
            />
          ),
        }}
      />
    </Tabs>
  );
};

export default RootLayout;
