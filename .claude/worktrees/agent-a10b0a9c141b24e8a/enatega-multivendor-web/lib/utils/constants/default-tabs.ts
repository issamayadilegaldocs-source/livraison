// lib/utils/constants/profileDefaultTabs.ts
"use client";
import { useTranslations } from "next-intl";
import { ITabItem } from "@/lib/utils/interfaces";
import { useConfig } from "@/lib/context/configuration/configuration.context";

export const useProfileDefaultTabs = (): ITabItem[] => {
  const t = useTranslations();
  const configuration = useConfig();
  const loyaltyEnabled = configuration?.LOYALTY_ENABLED ?? false;

  const tabs: ITabItem[] = [
    { label: t("profileDefaultTabs.tab1"), path: "/profile" },
    { label: t("profileDefaultTabs.tab2"), path: "/profile/addresses" },
    { label: t("profileDefaultTabs.tab3"), path: "/profile/order-history" },
    { label: t("profileDefaultTabs.tab4"), path: "/profile/settings" },
    { label: t("profileDefaultTabs.tab5"), path: "/profile/getHelp" },
    { label: t("profileDefaultTabs.tab6"), path: "/profile/customerTicket" },
  ];

  if (loyaltyEnabled) {
    tabs.splice(3, 0, {
      label: t("profileDefaultTabs.loyalty") || "🎁 Points",
      path: "/profile/loyalty",
    });
  }

  // Wallet tab always shown
  tabs.splice(loyaltyEnabled ? 4 : 3, 0, {
    label: t("profileDefaultTabs.wallet") || "💳 Wallet",
    path: "/profile/wallet",
  });

  return tabs;
};
