import { useQuery, useMutation } from "@apollo/client";
import { useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TouchableOpacity,
  View,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApptheme } from "@/lib/context/global/theme.context";
import { useTranslation } from "react-i18next";
import {
  MY_NOTIFICATIONS,
  MY_UNREAD_COUNT,
} from "@/lib/apollo/queries/notifications.query";
import {
  MARK_NOTIFICATIONS_READ,
  MARK_ALL_NOTIFICATIONS_READ,
} from "@/lib/apollo/mutations/user-notifications.mutation";

interface IUserNotification {
  _id: string;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  createdAt?: string;
}

function formatRelativeTime(createdAt?: string): string {
  if (!createdAt) return "";
  const ts = Number(createdAt);
  const date = Number.isNaN(ts) ? new Date(createdAt) : new Date(ts);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

export default function NotificationsScreen() {
  const { appTheme } = useApptheme();
  const { t } = useTranslation();

  const { data, loading, refetch } = useQuery(MY_NOTIFICATIONS, {
    variables: { limit: 50 },
    fetchPolicy: "cache-and-network",
  });

  const [markRead] = useMutation(MARK_NOTIFICATIONS_READ, {
    refetchQueries: [
      { query: MY_NOTIFICATIONS, variables: { limit: 50 } },
      { query: MY_UNREAD_COUNT },
    ],
  });

  const [markAllRead, { loading: markingAll }] = useMutation(
    MARK_ALL_NOTIFICATIONS_READ,
    {
      refetchQueries: [
        { query: MY_NOTIFICATIONS, variables: { limit: 50 } },
        { query: MY_UNREAD_COUNT },
      ],
    }
  );

  const notifications: IUserNotification[] = data?.myNotifications ?? [];
  const hasUnread = notifications.some((n) => !n.isRead);

  const handlePressNotif = useCallback(
    (n: IUserNotification) => {
      if (!n.isRead) {
        markRead({ variables: { ids: [n._id] } });
      }
    },
    [markRead]
  );

  const renderItem = ({ item }: { item: IUserNotification }) => (
    <TouchableOpacity
      onPress={() => handlePressNotif(item)}
      activeOpacity={0.7}
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: appTheme.borderLineColor,
        backgroundColor: item.isRead
          ? appTheme.themeBackground
          : appTheme.lowOpacityPrimaryColor ?? appTheme.borderLineColor + "22",
      }}
      accessibilityLabel={item.title}
      accessibilityRole="button"
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          marginTop: 6,
          marginRight: 12,
          backgroundColor: item.isRead ? "transparent" : appTheme.primary,
        }}
      />
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: appTheme.fontMainColor,
            fontWeight: item.isRead ? "400" : "700",
            fontSize: 14,
          }}
        >
          {item.title}
        </Text>
        <Text
          style={{
            color: appTheme.secondaryTextColor ?? appTheme.fontMainColor,
            fontSize: 13,
            marginTop: 2,
          }}
          numberOfLines={3}
        >
          {item.body}
        </Text>
        <Text
          style={{
            color: appTheme.secondaryTextColor ?? appTheme.fontMainColor,
            fontSize: 11,
            marginTop: 4,
          }}
        >
          {formatRelativeTime(item.createdAt)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView
      edges={["bottom", "left", "right"]}
      style={{ flex: 1, backgroundColor: appTheme.themeBackground }}
    >
      {hasUnread && (
        <TouchableOpacity
          onPress={() => markAllRead()}
          disabled={markingAll}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: appTheme.borderLineColor,
            alignItems: "flex-end",
          }}
          accessibilityRole="button"
          accessibilityLabel={t("markAllRead") || "Mark all as read"}
        >
          <Text
            style={{ color: appTheme.primary, fontSize: 13, fontWeight: "600" }}
          >
            {markingAll
              ? t("pleaseWait") || "Please wait…"
              : t("markAllRead") || "Mark all as read"}
          </Text>
        </TouchableOpacity>
      )}

      {loading && notifications.length === 0 ? (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator color={appTheme.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={refetch}
              tintColor={appTheme.primary}
            />
          }
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingTop: 60 }}>
              <Text
                style={{ color: appTheme.secondaryTextColor, fontSize: 16 }}
              >
                {t("noNotifications") || "No notifications yet"}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
