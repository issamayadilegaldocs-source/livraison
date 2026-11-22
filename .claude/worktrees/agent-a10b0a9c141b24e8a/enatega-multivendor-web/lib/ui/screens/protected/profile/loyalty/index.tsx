"use client";

import { useQuery } from "@apollo/client";
import { useTranslations } from "next-intl";
import { MY_LOYALTY_ACCOUNT } from "@/lib/api/graphql/queries/loyalty";
import { useConfig } from "@/lib/context/configuration/configuration.context";

export default function LoyaltyScreen() {
  const t = useTranslations();
  const configuration = useConfig();

  const LOYALTY_ENABLED = configuration?.LOYALTY_ENABLED ?? false;
  const REDEMPTION_RATE = configuration?.LOYALTY_POINTS_REDEMPTION_RATE ?? 0;
  const POINTS_PER_UNIT = configuration?.LOYALTY_POINTS_PER_UNIT ?? 1;
  const CURRENCY = configuration?.CURRENCY_SYMBOL ?? "$";

  const { data, loading } = useQuery(MY_LOYALTY_ACCOUNT, {
    skip: !LOYALTY_ENABLED,
    fetchPolicy: "network-only",
  });

  const points: number = data?.myLoyaltyAccount?.points ?? 0;
  const lifetimePoints: number = data?.myLoyaltyAccount?.lifetimePoints ?? 0;
  const cashValue = REDEMPTION_RATE > 0 ? (points / REDEMPTION_RATE).toFixed(2) : "0.00";

  if (!LOYALTY_ENABLED) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
        <span className="text-5xl mb-4">🎁</span>
        <p className="text-lg font-medium">{t("loyalty_not_enabled") || "Loyalty program not active"}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4 py-8 animate-pulse">
        <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
        <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 py-6 max-w-lg mx-auto">
      {/* Main balance card */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-6 shadow-lg">
        <p className="text-sm font-medium opacity-80 mb-1">
          {t("loyalty_balance_label") || "Available Points"}
        </p>
        <p className="text-5xl font-bold tracking-tight">{points.toLocaleString()}</p>
        <p className="text-sm mt-2 opacity-90">
          {t("loyalty_cash_value_label") || "Cash value"}:{" "}
          <span className="font-semibold">
            {CURRENCY}{cashValue}
          </span>
        </p>
      </div>

      {/* Lifetime stats */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 flex items-center gap-4">
        <span className="text-3xl">🏆</span>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("loyalty_lifetime_label") || "Total points earned"}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {lifetimePoints.toLocaleString()}
          </p>
        </div>
      </div>

      {/* How to earn */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <p className="font-semibold text-gray-900 dark:text-white mb-3">
          {t("loyalty_how_it_works") || "How it works"}
        </p>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <li className="flex items-start gap-2">
            <span className="text-emerald-500 mt-0.5">✓</span>
            {t("loyalty_earn_rule") || `Earn ${POINTS_PER_UNIT} point per ${CURRENCY}1 spent`}
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-500 mt-0.5">✓</span>
            {t("loyalty_redeem_rule") ||
              `${REDEMPTION_RATE} points = ${CURRENCY}1 discount`}
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-500 mt-0.5">✓</span>
            {t("loyalty_use_at_checkout") || "Redeem at checkout on any order"}
          </li>
        </ul>
      </div>
    </div>
  );
}
