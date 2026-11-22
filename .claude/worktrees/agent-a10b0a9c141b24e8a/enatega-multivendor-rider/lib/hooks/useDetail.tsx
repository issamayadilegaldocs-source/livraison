/* eslint-disable @typescript-eslint/no-explicit-any */
import { useContext, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";

import {
  ApolloCache,
  ApolloError,
  FetchResult,
  ServerError,
  ServerParseError,
  useMutation,
  useQuery,
  useSubscription,
} from "@apollo/client";
import { GraphQLFormattedError } from "graphql";
import { useTranslation } from "react-i18next";
import { GET_CONFIGURATION } from "../api/graphql/query/configuration";
import {
  ASSIGN_ORDER,
  MARK_ORDER_ARRIVED,
  UPDATE_ORDER_STATUS_RIDER,
} from "../apollo/mutations/order.mutation";
import { RIDER_EARNINGS_GRAPH } from "../apollo/queries/earnings.query";
import {
  RIDER_CURRENT_WITHDRAW_REQUEST,
  RIDER_ORDERS,
  RIDER_PROFILE,
  RIDER_TRANSACTIONS_HISTORY,
} from "../apollo/queries/rider.query";
import { SUBSCRIPTION_ORDERS } from "../apollo/subscriptions";
import UserContext from "../context/global/user.context";
import { FlashMessageComponent } from "../ui/useable-components";
import { IOrder } from "../utils/interfaces/order.interface";

const useDetails = (orderData: IOrder) => {
  // Hooks
  const { t } = useTranslation();
  const router = useRouter();
  const { assignedOrders, loadingAssigned, userId } = useContext(UserContext);
  const [order, setOrder] = useState<IOrder>(orderData);
  const cancelledHandled = useRef(false);

  useEffect(() => {
    if (!loadingAssigned && order) {
      setOrder(
        assignedOrders?.find((o) => o._id === order?._id) ?? ({} as IOrder),
      );
    }
  }, [assignedOrders]);

  const preparationTime = {
    hours: new Date(order?.preparationTime).getHours(),
    minutes: new Date(order?.preparationTime).getMinutes(),
    seconds: new Date(order?.preparationTime).getSeconds(),
  };

  const currentTime = {
    hours: new Date().getHours(),
    minutes: new Date().getMinutes(),
    seconds: new Date().getSeconds(),
  };

  const preparationSeconds =
    preparationTime.hours * 3600 +
    preparationTime.minutes * 60 +
    preparationTime.seconds;
  const currentSeconds =
    currentTime.hours * 3600 + currentTime.minutes * 60 + currentTime.seconds;

  const { data: subscriptionOrderData } = useSubscription(SUBSCRIPTION_ORDERS, {
    variables: { id: order?._id },
    skip: !order?._id,
  });

  // Alert the rider immediately if the active order gets cancelled
  useEffect(() => {
    if (!subscriptionOrderData?.subscriptionOrder) return;
    const { orderStatus, reason } = subscriptionOrderData.subscriptionOrder;
    if (orderStatus === "CANCELLED" && !cancelledHandled.current) {
      cancelledHandled.current = true;
      Alert.alert(
        t("Order Cancelled"),
        reason ?? t("The restaurant has cancelled this order."),
        [
          {
            text: t("OK"),
            onPress: () => router.replace("/(tabs)/home/orders"),
          },
        ],
        { cancelable: false },
      );
    }
  }, [subscriptionOrderData]);

  const {
    data: dataConfig,
    loading: loadingConfig,
    error: errorConfig,
  } = useQuery(GET_CONFIGURATION);

  const [mutateAssignOrder, { loading: loadingAssignOrder }] = useMutation(
    ASSIGN_ORDER,
    {
      refetchQueries: [{ query: RIDER_ORDERS }],
      onCompleted,
      onError,
      update,
    },
  );

  const [mutateOrderStatus, { loading: loadingOrderStatus }] = useMutation(
    UPDATE_ORDER_STATUS_RIDER,
    {
      onCompleted,
      onError,
      update,
      refetchQueries: [
        { query: RIDER_PROFILE },
        {
          query: RIDER_TRANSACTIONS_HISTORY,
          variables: { userId: userId, userType: "RIDER" },
        },
        {
          query: RIDER_CURRENT_WITHDRAW_REQUEST,
          variables: { riderId: userId },
        },
        {
          query: RIDER_EARNINGS_GRAPH,
          variables: { riderId: userId },
        },
        { query: RIDER_ORDERS },
      ],
    },
  );

  const [mutateOrderArrived, { loading: loadingOrderArrived }] = useMutation(
    MARK_ORDER_ARRIVED,
    {
      onCompleted,
      onError,
      update,
    },
  );

  async function onCompleted(result: any) {
    if (result.updateOrderStatusRider) {
      FlashMessageComponent({
        message: `${t("orderMarkedAs")} ${result.updateOrderStatusRider.orderStatus}`,
      });
    }
    if (result.assignOrder) {
      FlashMessageComponent({
        message: "Order assigned",
      });
      //   setActive("MyOrders");
    }
    if (result.markOrderArrived) {
      FlashMessageComponent({
        message: `${t("orderMarkedAs")} ${result.markOrderArrived.orderStatus}`,
      });
    }
  }

  function onError({
    cause,
    graphQLErrors,
    networkError,
  }: ApolloError) {
    let message = t("somethingWentWrong");
    if (networkError) message = "Network error. Please try again.";
    if (graphQLErrors) message = graphQLErrors.map((o) => o.message).join(", ");
    if (cause) message = cause.message;
    // A rider tapping Accept/Mark Picked Up/Mark Delivered in a weak-signal
    // spot previously saw nothing at all here (this was a bare console.log) —
    // the button appeared to do nothing, so the rider would re-tap or give up
    // and the order never advanced. Surface it so at least a manual retry is
    // possible; a proper offline queue (matching the location-tracking
    // service's retry discipline) is the fuller fix, tracked separately.
    FlashMessageComponent({ message });
  }

  async function update(cache: ApolloCache<any>, { data }: FetchResult<any>) {
    if (data?.assignOrder) {
      const existingData = cache.readQuery<{ riderOrders: IOrder[] }>({ query: RIDER_ORDERS });
      if (existingData) {
        const index = existingData.riderOrders.findIndex(
          (o: IOrder) => o._id === data.assignOrder._id,
        );
        if (index > -1) {
          // cache.readQuery returns frozen objects in dev — copy instead of
          // mutating in place, or Apollo throws "Cannot assign to read only property".
          const riderOrders = [...existingData.riderOrders];
          riderOrders[index] = {
            ...riderOrders[index],
            rider: data.assignOrder.rider,
            orderStatus: data.assignOrder.orderStatus,
          };
          cache.writeQuery({
            query: RIDER_ORDERS,
            data: { riderOrders },
          });
        }
      }
    }
    if (data?.updateOrderStatusRider) {
      const existingData = cache.readQuery<{ riderOrders: IOrder[] }>({ query: RIDER_ORDERS });
      if (existingData) {
        const index = existingData.riderOrders.findIndex(
          (o: IOrder) => o._id === data.updateOrderStatusRider._id,
        );
        if (index > -1) {
          const riderOrders = [...existingData.riderOrders];
          // Merge every field the mutation returned, not just orderStatus —
          // the dual-confirmation delivery flow keeps orderStatus at "PICKED"
          // after the rider's own delivery confirmation and only flips
          // riderDeliveredAt, so a status-only merge silently dropped that
          // timestamp and the UI kept showing the "mark as delivered" button
          // forever instead of the "waiting for customer" state.
          riderOrders[index] = {
            ...riderOrders[index],
            ...data.updateOrderStatusRider,
          };
          cache.writeQuery({
            query: RIDER_ORDERS,
            data: { riderOrders },
          });
        }
      }
    }
    if (data?.markOrderArrived) {
      const existingData = cache.readQuery<{ riderOrders: IOrder[] }>({ query: RIDER_ORDERS });
      if (existingData) {
        const index = existingData.riderOrders.findIndex(
          (o: IOrder) => o._id === data.markOrderArrived._id,
        );
        if (index > -1) {
          const riderOrders = [...existingData.riderOrders];
          riderOrders[index] = {
            ...riderOrders[index],
            ...data.markOrderArrived,
          };
          cache.writeQuery({
            query: RIDER_ORDERS,
            data: { riderOrders },
          });
        }
      }
    }
  }
  return {
    order,
    dataConfig,
    currentSeconds,
    preparationSeconds,
    loadingConfig,
    errorConfig,
    mutateAssignOrder,
    mutateOrderStatus,
    mutateOrderArrived,
    loadingAssignOrder,
    loadingOrderStatus,
    loadingOrderArrived,
  };
};

export default useDetails;
