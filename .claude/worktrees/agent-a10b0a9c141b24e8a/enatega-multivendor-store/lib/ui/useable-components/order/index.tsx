import { ConfigurationContext } from "@/lib/context/global/configuration.context";
import { MAX_TIME } from "@/lib/utils/constants";
import { IOrder } from "@/lib/utils/interfaces/order.interface";
import { orderSubTotal } from "@/lib/utils/methods";
import { getIsAcceptButtonVisible } from "@/lib/utils/methods/gloabl";
import { ORDER_TYPE } from "@/lib/utils/types";
import moment from "moment";
import { memo, useContext, useEffect, useRef, useState } from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import CountdownTimer from "../custom-timer";
import SpinnerComponent from "../spinner";
import { TimeLeftIcon } from "../svg";

// Hooks
import { useApptheme } from "@/lib/context/theme.context";
import useCancelOrder from "@/lib/hooks/useCancelOrder";
import useMarkOrderPrepared from "@/lib/hooks/useMarkOrderPrepared";
import useOrderPickedUp from "@/lib/hooks/useOrderPickedUp";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";

interface IOrderProps {
  order: IOrder;
  tab: ORDER_TYPE;
  handlePresentModalPress?: (order: IOrder) => void;
  showDetails: Record<string, boolean>;
  onToggleDetails: (itemId: string) => void;
}

const Order = ({
  order,
  tab,
  handlePresentModalPress,
  showDetails = {},
  onToggleDetails,
}: IOrderProps) => {
  // Hooks must be called unconditionally and in the same order on every
  // render — keep every hook above the early returns below.
  const { appTheme } = useApptheme();
  const configuration = useContext(ConfigurationContext);
  const { t } = useTranslation();
  const router = useRouter();
  const { cancelOrder, loading: loadingCancelOrder } = useCancelOrder();
  const { pickedUp, loading: loadingPicked } = useOrderPickedUp();
  const { markPrepared, loading: loadingPrepare } = useMarkOrderPrepared();

  // Ref
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // States
  const [isAcceptButtonVisible, setIsAcceptButtonVisible] = useState(
    getIsAcceptButtonVisible(order?.orderDate),
  );

  // Use Effects
  useEffect(() => {
    let isSubscribed = true;
    timer.current = setInterval(() => {
      const accept = !moment().isBefore(order?.orderDate);
      if (isSubscribed) {
        setIsAcceptButtonVisible(accept);
      }
      if (accept && timer.current) {
        clearInterval(timer.current);
      }
    }, 10000);
    return () => {
      if (timer.current) clearInterval(timer.current);
      isSubscribed = false;
    };
  }, [order?.orderDate]);

  if (!order) {
    return null; // Return early if order is not available
  }

  // Timer
  const timeNow = new Date();
  const date = new Date(order.orderDate);
  const acceptanceTime = moment(date).diff(timeNow, "seconds");
  const createdTime = new Date(order?.createdAt);
  let remainingTime = moment(createdTime)
    .add(MAX_TIME, "seconds")
    .diff(timeNow, "seconds");

  const decision = !isAcceptButtonVisible
    ? acceptanceTime
    : remainingTime > 0
      ? remainingTime
      : 0;

  if (decision === acceptanceTime) {
    remainingTime = 0;
  }

  // Handlers
  const onCancelOrderHandler = () => {
    cancelOrder(order._id, "not available");
  };

  const onPickupOrder = () => {
    pickedUp(order._id);
  };

  return (
    <View className="w-full">
      <View
        className="flex-1 gap-y-2 rounded-[8px] m-4 p-4"
        style={{
          backgroundColor: appTheme.themeBackground,
          borderWidth: 1,
          borderColor: appTheme.borderLineColor,
        }}
      >
        {/* Status */}
        <View className="flex-1 flex-row justify-between items-center">
          <Text
            style={{
              color: appTheme.fontMainColor,
              fontSize: 16,
              fontWeight: "bold",
            }}
          >
            {t("Status")}
          </Text>
          <View className="flex-row items-center gap-x-1.5">
            {order?.isExpress && (
              <View className="ps-2 pe-2 rounded-[12px] border border-orange-500 bg-orange-100">
                <Text style={{ color: "#C2410C", fontSize: 11, fontWeight: "700" }}>
                  ⚡ EXPRESS
                </Text>
              </View>
            )}
            {order?.orderStatus === "SCHEDULED" && (
              <View className="ps-2 pe-2 rounded-[12px] border border-blue-500 bg-blue-100">
                <Text style={{ color: "#1D4ED8", fontSize: 11, fontWeight: "700" }}>
                  🕐 SCHEDULÉ
                </Text>
              </View>
            )}
            <View
              className={`ps-3 pe-3 bg-green-100 border border-1 rounded-[12px] ${
                tab === "delivered"
                  ? "border-blue-500 bg-blue-100"
                  : tab === "processing"
                    ? "border-yellow-500 bg-yellow-100"
                    : "border-green-500 bg-green-100"
              }`}
            >
              <Text
                style={{
                  color:
                    tab === "delivered"
                      ? "navy"
                      : tab === "processing"
                        ? "#92400E"
                        : "#166534",
                  fontSize: 12,
                  fontWeight: "600",
                }}
              >
                {t(order?.orderStatus ?? "")}
              </Text>
            </View>
          </View>
        </View>

        {/* Order ID */}
        <View className="flex-1 flex-row justify-between items-center">
          <Text
            style={{
              color: appTheme.fontMainColor,
              fontSize: 16,
              fontWeight: "bold",
            }}
          >
            {t("orderID")}
          </Text>
          <Text
            style={{
              color: appTheme.fontMainColor,
              fontSize: 16,
              fontWeight: "600",
              textDecorationLine: "underline",
            }}
          >
            #{order?.orderId}
          </Text>
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: "/(protected)/order-detail",
                params: { id: order._id },
              })
            }
            accessibilityRole="button"
            accessibilityLabel="Voir détail"
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 8,
              backgroundColor: appTheme.primary + "22",
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "600", color: appTheme.primary }}>
              Détails →
            </Text>
          </TouchableOpacity>
        </View>

        {/* Order Items */}
        <View className="flex-1 flex-row justify-between items-center">
          <Text
            style={{
              color: appTheme.fontSecondColor,
              fontSize: 14,
              fontWeight: "bold",
            }}
          >
            {t("ORDER")}
          </Text>
          <Text
            style={{
              color: appTheme.fontSecondColor,
              fontSize: 14,
              fontWeight: "bold",
            }}
          >
            {t("PRICE")}
          </Text>
        </View>

        <View>
          {order?.items?.filter(Boolean).map((item) => {
            // Ensure variation is an object, default to empty if undefined.
            const variation = item.variation || {};
            const itemPrice = variation.price ?? 0;
            const itemTotal = itemPrice * (item.quantity ?? 1);

            return (
              <View
                key={item._id}
                className="flex-1 flex-row justify-between items-start mb-6"
              >
                {/* Left Side: Image and Details */}
                <View className="flex-row gap-x-2 flex-1">
                  {/* Image */}
                  <View
                    className="w-[60px] h-[70px] rounded-[8px] overflow-hidden"
                    style={{
                      backgroundColor: appTheme.lowOpacityPrimaryColor,
                    }}
                  >
                    <Image
                      src={item.image}
                      style={{ width: 60, height: 70, borderRadius: 8 }}
                    />
                  </View>

                  {/* Item Details */}
                  <View className="flex-1 justify-between">
                    <View>
                      <Text
                        style={{
                          color: appTheme.fontMainColor,
                          fontSize: 14,
                          fontWeight: "600",
                        }}
                      >
                        {`${item?.quantity}x ${item?.title}`}
                      </Text>
                      <Text
                        style={{
                          color: appTheme.fontSecondColor,
                          fontSize: 12,
                        }}
                      >
                        {item?.description}
                      </Text>
                      <Text
                        style={{
                          color: appTheme.fontSecondColor,
                          fontSize: 12,
                        }}
                      >
                        {item?.specialInstructions}
                      </Text>
                    </View>

                    {/* Toggle and Collapsible Details */}
                    <View className="mt-2">
                      {(variation.title || (item?.addons && item?.addons.length > 0)) && (
                        <TouchableOpacity
                          onPress={() => onToggleDetails(item._id)}
                          className="flex-row items-center mb-2"
                        >
                          <Text
                            style={{
                              color: appTheme.primary,
                              fontSize: 12,
                              fontWeight: "500",
                            }}
                          >
                            {showDetails[item._id] ? "Hide Details" : "Show Details"}
                          </Text>
                          <View className="ml-1">
                            <Text style={{ color: appTheme.primary, fontSize: 10 }}>
                              {showDetails[item._id] ? "▲" : "▼"}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      )}

                      {showDetails[item._id] && (
                        <View>
                          {variation.title && (
                            <View className="mb-2">
                              <View className="flex-row items-center">
                                <Text
                                  style={{
                                    color: appTheme.fontSecondColor,
                                    fontSize: 12,
                                    fontWeight: "500",
                                  }}
                                >
                                  {variation.title}
                                </Text>
                                <Text
                                  className="ml-2"
                                  style={{
                                    color: appTheme.fontMainColor,
                                    fontSize: 12,
                                    fontWeight: "600",
                                  }}
                                >
                                  {`${configuration?.currencySymbol}${variation.price}`}
                                </Text>
                              </View>
                            </View>
                          )}

                          {item?.addons?.map((addon) => (
                            <View key={addon._id} className="mb-1">
                              {addon?.options?.map((option) => (
                                <View key={option._id} className="flex-row items-center">
                                  <Text
                                    style={{
                                      color: appTheme.fontSecondColor,
                                      fontSize: 12,
                                    }}
                                  >
                                    {option.title}
                                  </Text>
                                  <Text
                                    className="ml-2"
                                    style={{
                                      color: appTheme.fontMainColor,
                                      fontSize: 12,
                                    }}
                                  >
                                    {`(+${configuration?.currencySymbol}${option?.price})`}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                {/* Right Side: Price */}
                <View className="w-auto items-end">
                  <Text style={{ color: appTheme.fontMainColor, fontWeight: "600" }}>
                    {`${configuration?.currencySymbol}${itemTotal.toFixed(2)}`}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Divider */}
        <View
          className="h-0.5 mb-4 mt-4"
          style={{ backgroundColor: appTheme.borderLineColor }}
        />

        {/* Sub Total */}
        <View className="flex-row justify-between">
          <Text
            style={{
              color: appTheme.fontMainColor,
              fontSize: 18,
              fontWeight: "600",
            }}
          >
            {t("subTotal")}
          </Text>
          <Text
            style={{
              color: appTheme.fontMainColor,
              fontSize: 18,
              fontWeight: "600",
            }}
          >
            {configuration?.currencySymbol}
            {orderSubTotal(order)}
          </Text>
        </View>

        {/* Tip */}
        <View className="flex-row justify-between">
          <Text
            style={{
              color: appTheme.fontMainColor,
              fontSize: 18,
              fontWeight: "600",
            }}
          >
            {t("Tip")}
          </Text>
          <Text
            style={{
              color: appTheme.fontMainColor,
              fontSize: 18,
              fontWeight: "600",
            }}
          >
            {configuration?.currencySymbol}
            {order?.tipping}
          </Text>
        </View>

        {/* Tax */}
        <View className="flex-row justify-between">
          <Text
            style={{
              color: appTheme.fontMainColor,
              fontSize: 18,
              fontWeight: "600",
            }}
          >
            {t("Tax")}
          </Text>
          <Text
            style={{
              color: appTheme.fontMainColor,
              fontSize: 18,
              fontWeight: "600",
            }}
          >
            {configuration?.currencySymbol}
            {order?.taxationAmount}
          </Text>
        </View>

        {/* Discount Amount */}
        {order?.discountAmount > 0 && (         
        <View className="flex-row justify-between">
          <Text
            style={{
              color: appTheme.fontMainColor,
              fontSize: 18,
              fontWeight: "600",
            }}
          >
            {t("discountAmount")}
          </Text>
          <Text
            style={{
              color: appTheme.fontMainColor,
              fontSize: 18,
              fontWeight: "600",
            }}
          >
            {configuration?.currencySymbol}
            {order?.discountAmount}
          </Text>
        </View>
        )}

        {/* Delivery */}
        {!order?.isPickedUp && <View className="flex-row justify-between">
          <Text
            style={{
              color: appTheme.fontMainColor,
              fontSize: 18,
              fontWeight: "600",
            }}
          >
            {t("deliveryCharges")}
          </Text>
          <Text
            style={{
              color: appTheme.fontMainColor,
              fontSize: 18,
              fontWeight: "600",
            }}
          >
            {configuration?.currencySymbol}
            {order?.deliveryCharges}
          </Text>
        </View>}

        {/* Total Amount */}
        <View className="flex-row justify-between">
          <Text
            style={{
              color: appTheme.fontMainColor,
              fontSize: 18,
              fontWeight: "600",
            }}
          >
            {t("Total")}
          </Text>
          <Text
            style={{
              color: appTheme.fontMainColor,
              fontSize: 18,
              fontWeight: "600",
            }}
          >
            {configuration?.currencySymbol}
            {order?.orderAmount}
          </Text>
        </View>

        {/* Order Instructions */}
        {!!order?.instructions && (
          <View
            className="rounded-[4px] p-2"
            style={{ backgroundColor: appTheme.lowOpacityPrimaryColor }}
          >
            <Text
              style={{
                color: appTheme.fontMainColor,
                fontSize: 18,
                fontWeight: "600",
              }}
            >
              {t("Comment")}
            </Text>
            <Text
              style={{
                color: appTheme.fontMainColor,
                fontSize: 18,
                fontWeight: "600",
                fontStyle: "italic",
              }}
            >
              {order?.instructions}
            </Text>
          </View>
        )}

        {/* New Order */}
        {order?.orderStatus === "PENDING" && (
          <View>
            <View className="flex-row gap-x-4 w-full mt-10">
              {/* Decline */}
              <TouchableOpacity
                className="flex-1 h-16 items-center justify-center rounded-[30px]"
                style={{ borderWidth: 1, borderColor: "#ef4444" }}
                onPress={() => onCancelOrderHandler()}
              >
                {loadingCancelOrder ? (
                  <SpinnerComponent color="#ef4444" />
                ) : (
                  <Text
                    style={{
                      color: "#ef4444",
                      fontSize: 18,
                      fontWeight: "500",
                    }}
                  >
                    {t("Decline")}
                  </Text>
                )}
              </TouchableOpacity>

              {/* Accept */}
              {handlePresentModalPress && (
                <TouchableOpacity
                  className="flex-1 h-16 items-center justify-center rounded-[30px]"
                  style={{
                    backgroundColor: appTheme.primary,
                    borderWidth: 1,
                    borderColor: appTheme.primary,
                  }}
                  onPress={() => handlePresentModalPress(order)}
                >
                  <Text
                    style={{
                      color: appTheme.white,
                      fontSize: 18,
                      fontWeight: "500",
                    }}
                  >
                    {t("Accept")}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Processing */}
        {["ACCEPTED", "PREPARED", "ASSIGNED", "PICKED"].includes(
          order?.orderStatus ?? "",
        ) && (
          <>
            <View className="w-full items-center">
              <View className="flex-row items-center justify-center gap-x-2">
                <TimeLeftIcon />
                <View>
                  <Text
                    style={{
                      color: appTheme.fontMainColor,
                      fontSize: 14,
                      fontWeight: "500",
                    }}
                  >
                    {t("timeLeft")}
                  </Text>

                  <CountdownTimer targetTime={order.preparationTime} />
                </View>
              </View>
            </View>

            {order.orderStatus === "ACCEPTED" && (
              <View className="flex-row gap-x-4 w-full mt-6">
                <TouchableOpacity
                  accessibilityLabel={t("Mark as Prepared")}
                  accessibilityRole="button"
                  className="flex-1 h-16 items-center justify-center rounded-[30px]"
                  style={{ backgroundColor: "#f59e0b", borderWidth: 1, borderColor: "#f59e0b" }}
                  onPress={() => markPrepared(order._id)}
                >
                  {loadingPrepare ? (
                    <SpinnerComponent color="#fff" />
                  ) : (
                    <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
                      {t("Mark as Prepared")}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {order.orderStatus === "ASSIGNED" && (
              <View className="flex-row gap-x-4 w-full mt-10">
                <TouchableOpacity
                  className="flex-1 h-16 items-center justify-center rounded-[30px]"
                  style={{
                    backgroundColor: appTheme.primary,
                    borderWidth: 1,
                    borderColor: appTheme.primary,
                  }}
                  onPress={() => onPickupOrder()}
                >
                  {loadingPicked ? (
                    <SpinnerComponent color={appTheme.white} />
                  ) : (
                    <Text
                      style={{
                        color: appTheme.white,
                        fontSize: 18,
                        fontWeight: "500",
                      }}
                    >
                      {t("handOrderToRider")}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
            {order.orderStatus === "ACCEPTED" && order.isPickedUp && (
              <View className="flex-row gap-x-4 w-full mt-10">
                {/* Hand Order to Rider */}
                <TouchableOpacity
                  className="flex-1 h-16 items-center justify-center rounded-[30px]"
                  style={{
                    backgroundColor: appTheme.primary,
                    borderWidth: 1,
                    borderColor: appTheme.primary,
                  }}
                  onPress={() => onPickupOrder()}
                >
                  {loadingPicked ? (
                    <SpinnerComponent color={appTheme.white} />
                  ) : (
                    <Text
                      style={{
                        color: appTheme.white,
                        fontSize: 18,
                        fontWeight: "500",
                      }}
                    >
                      {t("Deliver Order to Customer")}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Cancel — there was previously no way to cancel an order once
                accepted (an ingredient runs out, the customer phones to
                cancel); the backend already allows cancelling from ACCEPTED/
                PREPARED/AWAITING_RIDER/ASSIGNED (only PICKED+ is blocked, to
                avoid stranding a rider already in transit), this only adds
                the button. Reuses the same handler/reason as Decline. */}
            {order.orderStatus !== "PICKED" && (
              <View className="w-full mt-4 items-center">
                <TouchableOpacity
                  accessibilityLabel={t("Cancel Order")}
                  accessibilityRole="button"
                  onPress={() => onCancelOrderHandler()}
                >
                  {loadingCancelOrder ? (
                    <SpinnerComponent color="#ef4444" />
                  ) : (
                    <Text style={{ color: "#ef4444", fontSize: 14, fontWeight: "500" }}>
                      {t("Cancel Order")}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
};

// Memoized so a real-time status update (which only changes the affected
// order's object reference) re-renders just that card, not the whole list.
export default memo(Order);
