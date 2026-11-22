"use client";

import dynamic from "next/dynamic";

const NotificationsScreen = dynamic(
  () => import("@/lib/ui/screens/protected/notifications"),
  { ssr: false }
);

export default function NotificationsPage() {
  return <NotificationsScreen />;
}
