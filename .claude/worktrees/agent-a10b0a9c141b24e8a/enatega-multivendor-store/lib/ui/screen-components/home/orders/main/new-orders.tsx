import { useCallback, useMemo, useState } from "react";
import {
  Dimensions,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
// UI
import CustomTab from "@/lib/ui/useable-components/custom-tab";
// Constants
import { NO_ORDER_PROMPT, ORDER_DISPATCH_TYPE } from "@/lib/utils/constants";

// Interface
import { IOrderTabsComponentProps } from "@/lib/utils/interfaces";
import { IOrder } from "@/lib/utils/interfaces/order.interface";

// Hook
import { useApptheme } from "@/lib/context/theme.context";
import useOrders from "@/lib/hooks/useOrders";
import Order from "@/lib/ui/useable-components/order";
import SetTimeScreenAndAcceptOrder from "@/lib/ui/useable-components/set-order-accept-time";
import { WalletIcon } from "@/lib/ui/useable-components/svg";
import { ORDER_TYPE } from "@/lib/utils/types";
import { useTranslation } from "react-i18next";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import SpinnerComponent from "@/lib/ui/useable-components/spinner";

const { height } = Dimensions.get("window");

function HomeNewOrdersMain(props: IOrderTabsComponentProps) {
  // Props
  const { route } = props;

  // Hooks
  const { t } = useTranslation();
  const { appTheme } = useApptheme();
  const {
    loading,
    error,
    data,
    activeOrders,
    refetch,
    currentTab,
    setCurrentTab,
  } = useOrders();

  // States
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<IOrder | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [showDetails, setShowDetails] = useState<Record<string, boolean>>({});
  // Printer States

  //////////

  // Derived directly from context data on every render — avoids the stale-state
  // race a setState-in-effect approach had (it refetched on mount using the
  // previous render's empty `orders`, causing a visible reload/flicker every
  // time this tab was opened).
  const orders: IOrder[] = useMemo(() => {
    if (loading || error || !data) return [];
    return (
      activeOrders?.filter((order) =>
        currentTab === ORDER_DISPATCH_TYPE[0]
          ? !order?.isPickedUp
          : order?.isPickedUp
      ) ?? []
    );
  }, [activeOrders, currentTab, loading, error, data]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refetch();
    setRefreshing(false);
  }, [refetch]);

  const handlePresentModalPress = useCallback((order: IOrder) => {
    setSelectedOrder(order);
    setIsModalVisible(true);
  }, []);

  const handleDismissModal = useCallback(() => {
    setIsModalVisible(false);
    setSelectedOrder(null);
  }, []);

  const toggleShowDetails = useCallback((itemId: string) => {
    setShowDetails((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: IOrder }) => (
      <Order
        tab={route.key as ORDER_TYPE}
        order={item}
        handlePresentModalPress={handlePresentModalPress}
        showDetails={showDetails}
        onToggleDetails={toggleShowDetails}
      />
    ),
    [route.key, handlePresentModalPress, showDetails, toggleShowDetails],
  );

  const keyExtractor = useCallback((item: IOrder) => item._id, []);

  return (
    <GestureHandlerRootView style={style.gestureContainer}>
      <View
          className="pt-14 flex-1 items-center pb-20"
          style={[
            style.container,
            { backgroundColor: appTheme.themeBackground },
          ]}
        >
          <CustomTab
            options={ORDER_DISPATCH_TYPE}
            deliveryCount={
              activeOrders?.filter((o) => !o.isPickedUp).length ?? 0
            }
            pickupCount={
              activeOrders?.filter((o) => !!o.isPickedUp).length ?? 0
            }
            selectedTab={currentTab}
            setSelectedTab={setCurrentTab}
          />

          {loading && (!orders || orders?.length < 1) ? (
            <View className="flex-1">
              <SpinnerComponent />
            </View>
          ) : orders?.length > 0 ? (
            <FlatList
              className="w-full"
              keyExtractor={keyExtractor}
              data={orders}
              showsVerticalScrollIndicator={false}
              refreshing={refreshing}
              onRefresh={onRefresh}
              initialNumToRender={8}
              maxToRenderPerBatch={8}
              windowSize={5}
              removeClippedSubviews
              renderItem={renderItem}
              ListEmptyComponent={() => {
                return (
                  <View
                    style={{
                      minHeight:
                        height > 670
                          ? height - height * 0.5
                          : height - height * 0.6,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <WalletIcon
                      height={100}
                      width={100}
                      color={appTheme.fontMainColor}
                    />
                    {orders?.length === 0 ? (
                      <Text className="font-[Inter] text-[18px] text-base font-[500] text-gray-600">
                        {t(NO_ORDER_PROMPT[route.key])}
                      </Text>
                    ) : (
                      <Text>{t("pullDownToRefresh")}</Text>
                    )}
                  </View>
                );
              }}
            />
          ) : (
            <View
              style={{
                minHeight:
                  height > 670 ? height - height * 0.5 : height - height * 0.6,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <WalletIcon
                height={100}
                width={100}
                color={appTheme.fontMainColor}
              />

              {orders?.length === 0 ? (
                <Text className="font-[Inter] text-[18px] text-base font-[500] text-gray-600">
                  {t(NO_ORDER_PROMPT[route.key])}
                </Text>
              ) : (
                <Text>{t("pullDownToRefresh")}</Text>
              )}
            </View>
          )}
        </View>

      <Modal
        visible={isModalVisible}
        transparent
        animationType="slide"
        onRequestClose={handleDismissModal}
        statusBarTranslucent
      >
        <Pressable style={style.backdrop} onPress={handleDismissModal} />
        <View
          style={[
            style.sheet,
            { backgroundColor: appTheme.themeBackground },
          ]}
        >
          <View
            style={[
              style.handle,
              { backgroundColor: appTheme.fontSecondColor },
            ]}
          />
          <View
            style={[
              style.contentContainer,
              { backgroundColor: appTheme.themeBackground },
            ]}
          >
            {selectedOrder?._id && (
              <SetTimeScreenAndAcceptOrder
                id={selectedOrder?._id ?? ""}
                orderId={selectedOrder?.orderId ?? ""}
                handleDismissModal={handleDismissModal}
              />
            )}
          </View>
        </View>
      </Modal>
    </GestureHandlerRootView>
  );
}

export default HomeNewOrdersMain;

const style = StyleSheet.create({
  container: {
    paddingBottom: Platform.OS === "android" ? 50 : 80,
  },
  gestureContainer: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: height * 0.9,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    marginBottom: 8,
  },
  contentContainer: {
    alignItems: "center",
    paddingBottom: 30,
  },
});
