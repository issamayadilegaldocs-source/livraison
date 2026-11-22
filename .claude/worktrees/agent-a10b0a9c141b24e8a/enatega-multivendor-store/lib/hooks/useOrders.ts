import { useState, useContext } from "react";
// Context
import RestaurantProvider from "@/lib/context/global/restaurant";
// Interface
import { IOrder } from "@/lib/utils/interfaces/order.interface";
import { ORDER_DISPATCH_TYPE } from "../utils/constants";

export default function useOrders() {
  const [currentTab, setCurrentTab] = useState<string>(ORDER_DISPATCH_TYPE[0]);

  const { loading, error, data, refetch, networkStatus } = useContext(
    RestaurantProvider.Context,
  );
  const activeOrders: IOrder[] =
    data &&
    data?.restaurantOrders?.filter((order: IOrder) =>
      ["PENDING", "SCHEDULED"].includes(order?.orderStatus ?? ""),
    );

  const processingOrders: IOrder[] =
    data &&
    data?.restaurantOrders?.filter((order: IOrder) =>
      ["ACCEPTED", "PREPARED", "AWAITING_RIDER", "ASSIGNED", "PICKED"].includes(order?.orderStatus ?? ""),
    );

  const deliveredOrders: IOrder[] =
    data &&
    data?.restaurantOrders?.filter(
      (order: IOrder) => order?.orderStatus === "DELIVERED",
    );

  // The new-order ring must only fire for orders that actually need
  // immediate action. SCHEDULED orders have no Accept/Decline buttons at all
  // (they only get them once activated to PENDING by the backend scheduler
  // closer to their delivery time) and no way to mute/acknowledge them — so
  // including SCHEDULED here made the ring loop forever the moment a
  // customer scheduled an order for later, with no button to stop it short
  // of killing the app. `activeOrders` itself is left including SCHEDULED
  // so the New tab list/badge still shows them for visibility.
  const hasNewOrders =
    data?.restaurantOrders?.some(
      (order: IOrder) => order?.orderStatus === "PENDING",
    ) ?? false;

  return {
    loading,
    error,
    data,
    refetch,
    networkStatus,
    hasNewOrders,
    activeOrders,
    processingOrders,
    deliveredOrders,
    currentTab,
    setCurrentTab,
  };
}
