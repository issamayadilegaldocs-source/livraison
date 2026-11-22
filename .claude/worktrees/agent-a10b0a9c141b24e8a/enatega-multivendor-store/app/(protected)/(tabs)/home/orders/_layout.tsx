import { useApptheme } from "@/lib/context/theme.context";
import useOrders from "@/lib/hooks/useOrders";
import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, Text, View } from "react-native";

export default function Layout() {
  // Hooks
  const { t } = useTranslation();
  const { appTheme } = useApptheme();
  // Live order counts — derived from the same subscription-backed context that
  // feeds each tab's list, so the badges stay in sync with what's on screen.
  const { activeOrders, processingOrders } = useOrders();
  const newOrdersCount = activeOrders?.length ?? 0;
  const processingCount = processingOrders?.length ?? 0;

  // Renders a tab label with an optional numbered badge for ongoing orders.
  const renderLabel =
    (count: number) =>
    ({ children, focused }: { children: string; focused: boolean }) => (
      <View
        className="w-full"
        style={{
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          borderBottomWidth: focused ? 2 : 0,
          borderBottomColor: focused ? appTheme.primary : "transparent",
          paddingBottom: 8,
        }}
      >
        <Text
          style={{
            color: focused ? appTheme.fontMainColor : appTheme.fontSecondColor,
            fontWeight: 500,
            fontSize: 14,
            fontFamily: "Inter",
          }}
        >
          {children}
        </Text>
        {count > 0 && (
          <View
            style={{
              marginLeft: 6,
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              paddingHorizontal: 5,
              backgroundColor: appTheme.primary,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: appTheme.white ?? "#FFFFFF",
                fontSize: 11,
                fontWeight: "700",
                fontFamily: "Inter",
              }}
            >
              {count > 99 ? "99+" : count}
            </Text>
          </View>
        )}
      </View>
    );

  return (
    <Tabs
      screenOptions={{
        tabBarIcon: () => null,
        tabBarActiveTintColor: appTheme.primary,
        headerShown: false,
        tabBarIconStyle: {
          display: "none",
        },

        tabBarButton: (props) => {
          return (
            <Pressable
              {...props}
              android_ripple={{ color: "transparent" }}
              style={({ pressed }) => [
                props.style,
                { opacity: pressed ? 1 : 1 },
              ]}
            />
          );
        },
        tabBarPosition: "bottom",
        tabBarItemStyle: {
          height: 40,
          backgroundColor: "transparent",
        },

        tabBarStyle: Platform.select({
          ios: {
            position: "absolute",
            top: 0,
            height: 30,
            backgroundColor: appTheme.themeBackground,
            shadowColor: appTheme.themeBackground,
            shadowOpacity: 0,
            paddingTop: 20,
          },
          android: {
            position: "absolute",
            top: 0,
            height: 50,
            backgroundColor: appTheme.themeBackground,
            shadowColor: appTheme.themeBackground,
            shadowOpacity: 0,
            paddingTop: 20,
            elevation: 0,
          },
        }),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title:
            t("newOrders").length > 13
              ? t("newOrders").substring(0, 13).concat("..")
              : t("newOrders"),
          tabBarLabel: renderLabel(newOrdersCount),
        }}
      />
      <Tabs.Screen
        name="processing"
        options={{
          title:
            t("Processing").length > 13
              ? t("Processing").substring(0, 13).concat("..")
              : t("Processing"),
          tabBarLabel: renderLabel(processingCount),
        }}
      />
      <Tabs.Screen
        name="delivered"
        options={{
          title:
            t("Delivered").length > 13
              ? t("Delivered").substring(0, 13).concat("..")
              : t("Delivered"),
          tabBarLabel: renderLabel(0),
        }}
      />
    </Tabs>
  );
}
