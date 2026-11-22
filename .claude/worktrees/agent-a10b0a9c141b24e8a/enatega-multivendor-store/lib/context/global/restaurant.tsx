import { useApolloClient, useQuery } from "@apollo/client";
import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo } from "react-native";

import * as SecureStore from "../../utils/safeSecureStore";

// API
import { GET_ORDERS } from "@/lib/apollo/queries/orders";
import { SUBSCRIBE_PLACE_ORDER, SUBSCRIBE_RESTAURANT_ORDER_STATUS } from "@/lib/apollo/subscriptions";
import { resolveAndCacheStoreId } from "@/lib/utils/methods/resolve-store-id";
import { IRestaurantProviderProps } from "@/lib/utils/interfaces";

const Context = React.createContext({});

// Delay before a failed/killed subscription pair is reopened.
const RESUBSCRIBE_DELAY_MS = 5000;

const Provider = ({ children }: IRestaurantProviderProps) => {
  const apolloClient = useApolloClient();
  const [printer, setPrinter] = useState();
  const [notificationToken, setNotificationToken] = useState<string | null>(
    null,
  );

  useEffect(() => {
    (async () => {
      try {
        const printerStr = await SecureStore.getItemAsync("printer");
        if (printerStr) setPrinter(JSON.parse(printerStr));
      } catch (error) {
        console.error("Error fetching printer data from SecureStore:", error);
      }
    })();
  }, []);

  const { loading, error, data, subscribeToMore, refetch, networkStatus } =
    useQuery(GET_ORDERS, {
      // Render instantly from cache, then refresh in the background.
      // Real-time freshness comes from the two subscriptions below, so we do
      // NOT poll the network — the customer app relies on the same pattern.
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-first",
      onError: (error) => {
        console.log("GraphQL Query Error:", error);
      },
    });

  const unsubscribeNewOrderRef = useRef<(() => void) | null>(null);
  const unsubscribeStatusRef = useRef<(() => void) | null>(null);
  const resubscribeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const cancelledRef = useRef(false);
  const everSubscribedRef = useRef(false);

  const teardownSubscriptions = () => {
    unsubscribeNewOrderRef.current?.();
    unsubscribeNewOrderRef.current = null;
    unsubscribeStatusRef.current?.();
    unsubscribeStatusRef.current = null;
  };

  // A subscription that dies must not stay dead: the graphql-ws link only
  // retries transport drops, not GraphQL-level errors — and a Forbidden here
  // usually means the cached store-id went stale (e.g. after a DB reseed), so
  // the retry re-resolves the id from the session before reopening.
  const scheduleResubscribe = () => {
    if (cancelledRef.current || resubscribeTimerRef.current) return;
    resubscribeTimerRef.current = setTimeout(() => {
      resubscribeTimerRef.current = null;
      startSubscriptions();
    }, RESUBSCRIBE_DELAY_MS);
  };

  const startSubscriptions = async () => {
    if (cancelledRef.current) return;
    teardownSubscriptions();

    let restaurant: string | null = null;
    try {
      restaurant = await resolveAndCacheStoreId(apolloClient);
    } catch {
      // Network/server failure (or the session token isn't ready yet on a
      // fresh login) — fall back to the cached id so an offline tablet still
      // resubscribes, and let the retry loop refresh it later.
      restaurant = await SecureStore.getItemAsync("store-id");
      if (restaurant === null) {
        scheduleResubscribe();
        return;
      }
    }
    if (cancelledRef.current) return;
    if (!restaurant) {
      // Session genuinely has no linked restaurant — nothing to subscribe to.
      // The auth flow (finalizeSession) owns surfacing/signing out that case.
      console.error("No linked restaurant for this session; orders subscriptions not started.");
      return;
    }

    subscribeToNewOrders(restaurant);
    subscribeToOrderStatusChanges(restaurant);

    if (everSubscribedRef.current) {
      // Re-subscribing after a gap: pull anything missed while the stream was
      // down, otherwise orders placed during the outage never appear.
      refetch().catch(() => {});
    }
    everSubscribedRef.current = true;
  };

  useEffect(() => {
    cancelledRef.current = false;
    startSubscriptions();
    return () => {
      cancelledRef.current = true;
      if (resubscribeTimerRef.current) {
        clearTimeout(resubscribeTimerRef.current);
        resubscribeTimerRef.current = null;
      }
      teardownSubscriptions();
    };
  }, []);

  useEffect(() => {
    async function GetToken() {
      try {
        const result = await SecureStore.getItemAsync("notification-token");
        if (result) {
          setNotificationToken(JSON.parse(result));
        } else {
          setNotificationToken(null);
        }
      } catch (error) {
        console.error(
          "Error fetching notification token from SecureStore:",
          error,
        );
      }
    }
    GetToken();
  }, []);

  const subscribeToNewOrders = (restaurant: string) => {
    try {
      unsubscribeNewOrderRef.current = subscribeToMore({
        document: SUBSCRIBE_PLACE_ORDER,
        variables: { restaurant },
        updateQuery: (prev, { subscriptionData }) => {
          if (!subscriptionData.data) return prev;
          const { restaurantOrders = [] } = prev;
          const { origin, order } = subscriptionData.data.subscribePlaceOrder;
          if (origin === "new") {
            // Guard against duplicates: a reconnect can replay the event, and
            // the background refetch may already hold this order.
            if (restaurantOrders.some((o: { _id: string }) => o._id === order._id)) {
              return prev;
            }
            // Store staff may not be watching the screen — announce the
            // arrival for screen readers alongside the looping new-order beep.
            AccessibilityInfo?.announceForAccessibility?.(
              `Nouvelle commande #${order.orderId ?? ""}`,
            );
            return {
              restaurantOrders: [order, ...restaurantOrders],
            };
          }
          return prev;
        },
        onError: (error) => {
          console.error("Subscription Error:", error);
          scheduleResubscribe();
        },
      });
    } catch (error) {
      console.error("Error in subscribeToNewOrders:", error);
      scheduleResubscribe();
    }
  };

  const subscribeToOrderStatusChanges = (restaurantId: string) => {
    try {
      unsubscribeStatusRef.current = subscribeToMore({
        document: SUBSCRIBE_RESTAURANT_ORDER_STATUS,
        variables: { restaurantId },
        updateQuery: (prev, { subscriptionData }) => {
          if (!subscriptionData.data) return prev;
          const updatedOrder = subscriptionData.data.subscriptionRestaurantOrderStatus;
          if (!updatedOrder?._id) return prev;
          return {
            restaurantOrders: prev.restaurantOrders.map((o: { _id: string }) =>
              o._id === updatedOrder._id ? { ...o, ...updatedOrder } : o,
            ),
          };
        },
        onError: (error) => {
          console.error("Order status subscription error:", error);
          scheduleResubscribe();
        },
      });
    } catch (error) {
      console.error("Error in subscribeToOrderStatusChanges:", error);
      scheduleResubscribe();
    }
  };

  const value = useMemo(
    () => ({
      loading,
      error,
      data,
      subscribeToMoreOrders: startSubscriptions,
      refetch,
      networkStatus,
      printer,
      setPrinter,
      notificationToken,
    }),
    [loading, error, data, networkStatus, printer, notificationToken],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
};

export const useRestaurantContext = () => useContext(Context);
export default { Context, Provider };
