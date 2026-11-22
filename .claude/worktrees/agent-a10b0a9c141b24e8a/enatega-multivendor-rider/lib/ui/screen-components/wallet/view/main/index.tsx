// Interfaces
import { ILazyQueryResult } from "@/lib/utils/interfaces";
import {
  IRiderByIdResponse,
  IRiderCurrentWithdrawRequestResponse,
  // IRiderEarningsResponse,
  IRiderTransactionHistoryResponse,
} from "@/lib/utils/interfaces/rider.interface";

// Components
import {
  CustomContinueButton,
  FlashMessageComponent,
  NoRecordFound,
} from "@/lib/ui/useable-components";
import WithdrawModal from "../form";
import RecentTransaction from "../recent-transactions";

// Hooks
import { useUserContext } from "@/lib/context/global/user.context";
import { useLazyQueryQL } from "@/lib/hooks/useLazyQueryQL";
import { useMutation } from "@apollo/client";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "expo-router";

// Utils
import { formatCurrency } from "@/lib/utils/methods/custom-functions";

// GraphQL
import { CREATE_WITHDRAW_REQUEST } from "@/lib/apollo/mutations/withdraw-request.mutation";
import {
  RIDER_BY_ID,
  RIDER_CURRENT_WITHDRAW_REQUEST,
  RIDER_TRANSACTIONS_HISTORY,
} from "@/lib/apollo/queries";
import { GraphQLError } from "graphql";

// Expo
import { router } from "expo-router";

// Core
import { Alert, RefreshControl, ScrollView, Text, View } from "react-native";

// Skeletons
import { useApptheme } from "@/lib/context/global/theme.context";
import { WalletScreenMainLoading } from "@/lib/ui/skeletons";

export default function WalletMain() {
  // Hooks
  const { appTheme } = useApptheme();
  const { t } = useTranslation();

  // States
  const [isBottomModalOpen, setIsBottomModalOpen] = useState(false);
  const [amountErrMsg, setAmountErrMsg] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const { userId } = useUserContext();

  // Queries

  const {
    data: riderTransactionData,
    fetch: fetchRiderTransactions,
    loading: isRiderTransactionLoading,
  } = useLazyQueryQL(
    RIDER_TRANSACTIONS_HISTORY,
    { fetchPolicy: "network-only", debounceMs: 0 },
    {
      userType: "RIDER",
      userId: userId,
    },
  ) as ILazyQueryResult<
    IRiderTransactionHistoryResponse | undefined,
    {
      userType: string;
      userId: string;
    }
  >;
  const {
    data: riderProfileData,
    fetch: fetchRiderProfile,
    loading: isRiderProfileLoading,
  } = useLazyQueryQL(
    RIDER_BY_ID,
    { enabled: !!userId, fetchPolicy: "network-only", debounceMs: 0 },
    {},
  ) as ILazyQueryResult<IRiderByIdResponse | undefined, Record<string, never>>;

  const {
    data: riderCurrentWithdrawRequestData,
    fetch: fetchRiderCurrentWithdrawRequest,
    loading: isRiderCurrentWithdrawRequestLoading,
  } = useLazyQueryQL(
    RIDER_CURRENT_WITHDRAW_REQUEST,
    { fetchPolicy: "network-only", debounceMs: 0 },
    { riderId: userId },
  ) as ILazyQueryResult<
    IRiderCurrentWithdrawRequestResponse | undefined,
    {
      riderId: string;
    }
  >;

  // Mutaions
  const [createWithDrawRequest, { loading: createWithDrawRequestLoading }] =
    useMutation(CREATE_WITHDRAW_REQUEST, {
      onCompleted: () => {
        FlashMessageComponent({
          message: t("successfullyCreatedTheWithdrawRequest"),
        });
        setIsBottomModalOpen(false);
        // setIsModalVisible(true)
        router.push({
          pathname: "/(tabs)/wallet/(routes)/success",
        });
      },
      onError: (error) => {
        Alert.alert(t("Warning"), error.message, [
          {
            onPress: () => setIsBottomModalOpen(false),
            text: t("Okay"),
          },
        ]);
        FlashMessageComponent({
          message:
            error.message ||
            error.graphQLErrors[0].message ||
            JSON.stringify(error) ||
            t("somethingWentWrong"),
        });
      },
      refetchQueries: [
        { query: RIDER_BY_ID },
        {
          query: RIDER_TRANSACTIONS_HISTORY,
          variables: { userId: userId, userType: "RIDER" },
        },
        {
          query: RIDER_CURRENT_WITHDRAW_REQUEST,
          variables: { riderId: userId },
        },
      ],
    });

  // Handlers
  async function handleFormSubmission(withdrawAmount: number) {
    if (typeof withdrawAmount !== "number" || isNaN(withdrawAmount) || withdrawAmount <= 0) {
      return setAmountErrMsg(t("pleaseEnterAValidNumber"));
    }
    if (withdrawAmount < 10) {
      return setAmountErrMsg(t("The withdraw amount must be at least $10"));
    }
    if (withdrawAmount > availableBalance) {
      return setAmountErrMsg(
        `${t("pleaseEnterAValidAmountYouHave")} ${formatCurrency(availableBalance)} ${t("available")}.`,
      );
    }
    try {
      await createWithDrawRequest({
        variables: {
          requestAmount: withdrawAmount,
        },
      });
    } catch (error) {
      const err = error as GraphQLError;

      // FlashMessageComponent({
      //   message:
      //     err.message || JSON.stringify(error) || t("Something went wrong"),
      // });

      console.log("error wallet", err);
    }
  }
  // Only show skeleton on initial data load, not while submitting the withdraw mutation
  const isLoading =
    isRiderProfileLoading ||
    isRiderTransactionLoading ||
    isRiderCurrentWithdrawRequestLoading;

  // Refetch all wallet data
  const refetchAll = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
    await Promise.all([
      fetchRiderProfile(),
      fetchRiderTransactions(),
      fetchRiderCurrentWithdrawRequest({ riderId: userId }),
    ]);
    setRefreshing(false);
  }, [userId]);

  useEffect(() => {
    refetchAll();
  }, [refetchAll]);

  // Refresh whenever the rider navigates back to the wallet tab
  useFocusEffect(
    useCallback(() => {
      refetchAll();
    }, [refetchAll]),
  );
  const nonPendingTransactions =
    riderTransactionData?.transactionHistory.transactions.filter(
      (t) => t.status !== "PENDING",
    ) ?? [];

  const currentBalance = riderProfileData?.riderProfile.currentWalletAmount ?? 0;
  const pendingAmount =
    riderCurrentWithdrawRequestData?.riderCurrentWithdrawRequest?.requestAmount ?? 0;
  // Available = balance minus any pending withdrawal (not yet approved by admin)
  const availableBalance = Math.max(0, currentBalance - pendingAmount);

  // Only show the full skeleton on the very first load. useFocusEffect
  // refetches on every visit to this tab (network-only), which would
  // otherwise flash the skeleton back in on top of data we already have.
  if (isLoading && !refreshing && !riderProfileData) return <WalletScreenMainLoading />;
  return (
    <View className="w-[100%] h-full" style={{ backgroundColor: appTheme.screenBackground }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refetchAll} />
        }
      >
        {/* Solde actuel */}
        <View
          className="flex flex-column gap-4 items-center m-4 p-4 rounded-lg"
          style={{ backgroundColor: appTheme.themeBackground }}
        >
          <Text
            className="text-[18px] font-[600]"
            style={{ color: appTheme.secondaryTextColor }}
          >
            {t("Available Balance")}
          </Text>
          <Text
            className="font-semibold text-[32px]"
            style={{ color: appTheme.fontMainColor }}
          >
            {formatCurrency(availableBalance)}
          </Text>
          {pendingAmount > 0 && (
            <Text className="text-xs" style={{ color: "#F59E0B" }}>
              {formatCurrency(pendingAmount)} {t("reserved — pending admin approval")}
            </Text>
          )}
          <View
            className="flex flex-row justify-between w-full px-2 pt-2"
            style={{ borderTopColor: appTheme.borderLineColor, borderTopWidth: 1 }}
          >
            <View className="flex flex-col items-center">
              <Text className="text-xs" style={{ color: appTheme.secondaryTextColor }}>
                {t("Total Earned")}
              </Text>
              <Text className="font-semibold text-sm" style={{ color: appTheme.fontMainColor }}>
                {formatCurrency(riderProfileData?.riderProfile.totalWalletAmount ?? 0)}
              </Text>
            </View>
            <View className="flex flex-col items-center">
              <Text className="text-xs" style={{ color: appTheme.secondaryTextColor }}>
                {t("Total Withdrawn")}
              </Text>
              <Text className="font-semibold text-sm" style={{ color: appTheme.fontMainColor }}>
                {formatCurrency(riderProfileData?.riderProfile.withdrawnWalletAmount ?? 0)}
              </Text>
            </View>
          </View>
          <CustomContinueButton
            title={t("withdrawNow")}
            disabled={!!riderCurrentWithdrawRequestData?.riderCurrentWithdrawRequest}
            onPress={() => {
              if (!riderCurrentWithdrawRequestData?.riderCurrentWithdrawRequest) {
                setIsBottomModalOpen((prev) => !prev);
              }
            }}
            style={
              riderCurrentWithdrawRequestData?.riderCurrentWithdrawRequest
                ? { opacity: 0.5 }
                : undefined
            }
          />
        </View>

        {/* Demande en attente */}
        {riderCurrentWithdrawRequestData?.riderCurrentWithdrawRequest
          ?.requestAmount !== 0 &&
          riderCurrentWithdrawRequestData?.riderCurrentWithdrawRequest && (
            <View
              style={{
                backgroundColor: appTheme.themeBackground,
                borderBottomColor: appTheme.borderLineColor,
                borderBottomWidth: 1,
              }}
            >
              <Text
                className="font-bold text-lg p-5 mt-4"
                style={{ color: appTheme.fontMainColor }}
              >
                {t("pendingRequest")}
              </Text>
              <RecentTransaction
                transaction={{
                  amountTransferred:
                    riderCurrentWithdrawRequestData.riderCurrentWithdrawRequest
                      .requestAmount || 0,
                  status:
                    riderCurrentWithdrawRequestData.riderCurrentWithdrawRequest
                      .status,
                  createdAt:
                    riderCurrentWithdrawRequestData.riderCurrentWithdrawRequest
                      .createdAt,
                }}
                key={riderCurrentWithdrawRequestData.riderCurrentWithdrawRequest.createdAt}
                isLast={false}
              />
            </View>
          )}

        {/* Transactions récentes */}
        <Text
          className="font-bold text-lg p-5 mt-4"
          style={{
            backgroundColor: appTheme.themeBackground,
            borderBottomColor: appTheme.borderLineColor,
            borderBottomWidth: 1,
            color: appTheme.fontMainColor,
          }}
        >
          {t("recentTransactions")}
        </Text>

        {nonPendingTransactions.map((transaction, index) => (
          <RecentTransaction
            transaction={transaction}
            key={transaction.createdAt + index}
            isLast={nonPendingTransactions.length - 1 === index}
          />
        ))}
        {!nonPendingTransactions.length && <NoRecordFound />}
      </ScrollView>

      <WithdrawModal
        isBottomModalOpen={isBottomModalOpen}
        setIsBottomModalOpen={setIsBottomModalOpen}
        amountErrMsg={amountErrMsg}
        setAmountErrMsg={setAmountErrMsg}
        currentTotal={availableBalance}
        handleFormSubmission={handleFormSubmission}
        withdrawRequestLoading={createWithDrawRequestLoading}
      />
    </View>
  );
}
