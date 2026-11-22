"use client";
import dynamic from "next/dynamic";

const LoyaltyScreen = dynamic(
  () => import("@/lib/ui/screens/protected/profile").then((m) => m.LoyaltyScreen),
  { ssr: false }
);

export default function LoyaltyPage() {
  return <LoyaltyScreen />;
}
