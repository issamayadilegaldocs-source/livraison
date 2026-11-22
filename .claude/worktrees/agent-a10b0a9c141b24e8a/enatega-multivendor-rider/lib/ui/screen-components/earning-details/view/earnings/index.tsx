// Core
import { Text } from "react-native";

// Interfaces
import { IRiderEarningsDetailProps } from "@/lib/utils/interfaces/earning.interface";

// Components
import { useApptheme } from "@/lib/context/global/theme.context";
import NoRecordFound from "@/lib/ui/useable-components/no-record-found";
import { useTranslation } from "react-i18next";
import { FlatList } from "react-native-gesture-handler";
import EarningStack from "../../../earnings/view/earnings-stack";

export default function EarningsDetailStacks({
  riderEarningsData,
  isRiderEarningsLoading,
  setModalVisible,
}: IRiderEarningsDetailProps) {
  // Hooks
  const { appTheme } = useApptheme();
  const { t } = useTranslation();

  // If Loading
  if (isRiderEarningsLoading) return <NoRecordFound />;

  return (
    <FlatList
      data={riderEarningsData?.riderEarningsGraph?.earnings}
      contentContainerClassName="scroll-smooth pb-12"
      keyExtractor={(item, index) => item?._id?.toString() ?? `${item?.date ?? 'row'}-${index}`}
      style={{ height: "55%" }}
      ListEmptyComponent={
        <Text
          className="block mx-auto font-bold text-center w-full my-12 "
          style={{ color: appTheme.fontSecondColor }}
        >
          {t("noRecordFound")}
        </Text>
      }
      renderItem={({ item }) => (
        <EarningStack
          date={item?.date}
          earning={item?.totalEarningsSum}
          totalDeliveries={item?.earningsArray.length}
          _id={item?._id}
          tip={item?.totalTipsSum}
          earningsArray={item?.earningsArray}
          setModalVisible={setModalVisible}
        />
      )}
    />
  );
}
