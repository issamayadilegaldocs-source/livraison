"use client";
import dynamic from "next/dynamic";

const WalletScreen = dynamic(
  () => import("@/lib/ui/screens/protected/profile/wallet"),
  { ssr: false }
);

export default function WalletPage() {
  return <WalletScreen />;
}
