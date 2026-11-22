"use client";

import { useMutation, useQuery } from "@apollo/client";
import { useTranslations } from "next-intl";
import { MY_WALLET, INITIATE_WALLET_TOPUP } from "@/lib/api/graphql";
import { useConfig } from "@/lib/context/configuration/configuration.context";
import { useState } from "react";

const TOP_UP_AMOUNTS = [5, 10, 20, 50];

export default function WalletScreen() {
  const t = useTranslations();
  const { CURRENCY_SYMBOL, CURRENCY_DECIMAL_DIGITS } = useConfig();
  const decimals = CURRENCY_DECIMAL_DIGITS ?? 2;

  const { data, loading, refetch } = useQuery(MY_WALLET, {
    fetchPolicy: "network-only",
  });

  const [topUpLoading, setTopUpLoading] = useState(false);
  const [topUpError, setTopUpError] = useState<string | null>(null);
  const [initiateTopUp] = useMutation(INITIATE_WALLET_TOPUP);

  const balance: number = data?.myWallet?.balance ?? 0;

  async function handleTopUp(amount: number) {
    if (topUpLoading) return;
    setTopUpLoading(true);
    setTopUpError(null);
    try {
      const { data: result } = await initiateTopUp({ variables: { amount } });
      const link: string | undefined = result?.initiateWalletTopUp;
      if (link) {
        window.location.href = link;
      }
    } catch {
      setTopUpError(t("wallet_topup_error") || "Top-up failed. Please try again.");
    } finally {
      setTopUpLoading(false);
    }
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
      {/* Balance card */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white p-6 shadow-lg">
        <p className="text-sm font-medium opacity-80 mb-1">
          {t("wallet_balance_label") || "Available Balance"}
        </p>
        <p className="text-5xl font-bold tracking-tight">
          {balance.toFixed(decimals)}
        </p>
        <p className="text-sm mt-2 opacity-90">{CURRENCY_SYMBOL || "TND"}</p>
      </div>

      {/* Top-up section */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <p className="font-semibold text-gray-900 dark:text-white mb-3">
          {t("wallet_topup_label") || "Top Up Wallet"}
        </p>
        <div className="grid grid-cols-4 gap-2 mb-3">
          {TOP_UP_AMOUNTS.map((amt) => (
            <button
              key={amt}
              disabled={topUpLoading}
              onClick={() => handleTopUp(amt)}
              className="py-2 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-semibold text-sm transition-colors"
            >
              +{amt}
            </button>
          ))}
        </div>
        {topUpError && (
          <p className="text-sm text-red-500 mt-1">{topUpError}</p>
        )}
        {topUpLoading && (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center animate-pulse">
            {t("loading") || "Redirecting to payment…"}
          </p>
        )}
      </div>

      {/* Info card */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <p className="font-semibold text-gray-900 dark:text-white mb-3">
          {t("wallet_how_it_works") || "How it works"}
        </p>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <li className="flex items-start gap-2">
            <span className="text-blue-500 mt-0.5">✓</span>
            {t("wallet_credit_info") ||
              "Your wallet is credited automatically when a paid order is refunded"}
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500 mt-0.5">✓</span>
            {t("wallet_use_info") ||
              'Select "Wallet" as payment method at checkout to use your balance'}
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500 mt-0.5">✓</span>
            {t("wallet_instant_info") ||
              "Wallet payments are instant — no gateway redirect needed"}
          </li>
        </ul>
      </div>
    </div>
  );
}
