"use client";

import { useEffect } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { MY_NOTIFICATIONS } from "@/lib/api/graphql/queries/notifications";
import { MARK_NOTIFICATIONS_READ } from "@/lib/api/graphql/mutations/loyalty-notifications";
import { useAuth } from "@/lib/context/auth/auth.context";
import { useTranslations } from "next-intl";

interface INotification {
  _id: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationsScreen() {
  const { authToken } = useAuth();
  const t = useTranslations();

  const { data, loading } = useQuery(MY_NOTIFICATIONS, {
    skip: !authToken,
    fetchPolicy: "network-only",
  });

  const [markRead] = useMutation(MARK_NOTIFICATIONS_READ, {
    refetchQueries: [{ query: MY_NOTIFICATIONS }],
  });

  useEffect(() => {
    if (authToken && data?.myNotifications?.some((n: INotification) => !n.isRead)) {
      markRead();
    }
  }, [data, authToken]);

  const notifications: INotification[] = data?.myNotifications ?? [];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6 dark:text-white">{t("notifications_title")}</h1>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {!loading && notifications.length === 0 && (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <div className="text-5xl mb-4">🔔</div>
          <p className="text-lg">{t("no_notifications_label")}</p>
        </div>
      )}

      {!loading && notifications.length > 0 && (
        <ul className="space-y-3">
          {notifications.map((n) => (
            <li
              key={n._id}
              className={`flex items-start gap-3 p-4 rounded-lg border ${
                n.isRead
                  ? "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                  : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700"
              }`}
            >
              {!n.isRead && (
                <span className="mt-2 w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
              )}
              <div className={`flex-1 ${n.isRead ? "" : ""}`}>
                <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{n.title}</p>
                <p className="text-gray-600 dark:text-gray-300 text-sm mt-0.5">{n.body}</p>
                <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">{timeAgo(n.createdAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
