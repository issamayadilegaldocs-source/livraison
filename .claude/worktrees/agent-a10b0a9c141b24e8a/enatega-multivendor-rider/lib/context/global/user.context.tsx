import { useAuth, useSession } from "@clerk/clerk-expo";
import { QueryResult, useMutation, useQuery } from "@apollo/client";
import {
  requestForegroundPermissionsAsync,
} from "expo-location";
import * as Notifications from "expo-notifications";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

import {
  IRiderProfileResponse,
  IUserContextProps,
  IUserProviderProps,
} from "@/lib/utils/interfaces";
import { LINK_RIDER_ACCOUNT } from "@/lib/apollo/mutations/rider.mutation";
import { PUSH_TOKEN } from "@/lib/apollo/mutations/push-token.mutation";
import { RIDER_ORDERS, RIDER_PROFILE } from "@/lib/apollo/queries";
import { getNotificationToken } from "@/lib/utils/methods/permission";
import {
  SUBSCRIPTION_ASSIGNED_RIDER,
  SUBSCRIPTION_ZONE_ORDERS,
} from "@/lib/apollo/subscriptions";
import { IOrder } from "@/lib/utils/interfaces/order.interface";
import {
  IRiderEarnings,
  IRiderEarningsArray,
} from "@/lib/utils/interfaces/rider-earnings.interface";

const UserContext = createContext<IUserContextProps>({} as IUserContextProps);

export const UserProvider = ({ children }: IUserProviderProps) => {
  const { userId } = useAuth();
  const { session } = useSession();

  const [modalVisible, setModalVisible] = useState<
    IRiderEarnings & { bool: boolean }
  >({
    bool: false,
    _id: "",
    date: "",
    earningsArray: [] as IRiderEarningsArray[],
    totalEarningsSum: 0,
    totalTipsSum: 0,
    totalDeliveries: 0,
  });
  const [riderOrderEarnings, setRiderOrderEarnings] = useState<
    IRiderEarningsArray[]
  >([] as IRiderEarningsArray[]);
  const [zoneId, setZoneId] = useState("");
  const [incomingOrder, setIncomingOrder] = useState<IOrder | null>(null);

  const linkAttempted = useRef(false);

  const {
    loading: loadingProfile,
    error: errorProfile,
    data: dataProfile,
    refetch: refetchProfile,
  } = useQuery(RIDER_PROFILE, {
    fetchPolicy: "cache-first",
    skip: !userId,
  }) as QueryResult<IRiderProfileResponse | undefined, Record<string, never>>;

  const [linkRiderAccount] = useMutation(LINK_RIDER_ACCOUNT);
  const [registerPushToken] = useMutation(PUSH_TOKEN);

  const {
    client,
    loading: loadingAssigned,
    error: errorAssigned,
    data: dataAssigned,
    networkStatus: networkStatusAssigned,
    subscribeToMore,
    refetch: refetchAssigned,
  } = useQuery(RIDER_ORDERS, {
    // Render the last-known orders instantly from cache, then refresh in the
    // background. Live updates still arrive via the subscriptions below, so we
    // never poll the network.
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    notifyOnNetworkStatusChange: true,
    skip: !userId,
    variables: {
      userId,
    },
  });

  useEffect(() => {
    if (!dataProfile?.riderProfile?._id) return;

    // ASSIGNED_RIDER subscription always active so admin calls reach the rider regardless of availability
    const riderId = dataProfile?.riderProfile?._id ?? userId ?? "";
    console.log("[RIDER] subscriptionAssignRider started, riderId=", riderId);
    const unsubAssignOrder = subscribeToMore({
      document: SUBSCRIPTION_ASSIGNED_RIDER,
      variables: { riderId },
      onError: (err) => console.error("[RIDER] subscriptionAssignRider error:", err),
      updateQuery: (prev, { subscriptionData }) => {
        if (!subscriptionData.data) return prev;
        const { origin, order } = subscriptionData.data.subscriptionAssignRider;
        console.log("[RIDER] subscriptionAssignRider event:", origin, order?._id);

        if (origin === "call") {
          setIncomingOrder(order);
          // Also add to riderOrders so the Processing tab shows it immediately
          return {
            riderOrders: [
              order,
              ...prev.riderOrders.filter((o: IOrder) => o._id !== order._id),
            ],
          };
        }
        if (origin === "new" || origin === "assign") {
          return {
            riderOrders: [
              order,
              ...prev.riderOrders.filter((o: IOrder) => o._id !== order._id),
            ],
          };
        }
        if (origin === "remove") {
          return {
            riderOrders: prev.riderOrders.filter((o: IOrder) => o._id !== order._id),
          };
        }
        return prev;
      },
    });

    // Zone subscription only active when rider is available AND has a zone
    let unsubZoneOrder: (() => void) | undefined;
    if (dataProfile.riderProfile.available && dataProfile?.riderProfile?.zone?._id) {
      unsubZoneOrder = subscribeToMore({
        document: SUBSCRIPTION_ZONE_ORDERS,
        variables: { zoneId: dataProfile?.riderProfile?.zone?._id ?? zoneId },
        updateQuery: (prev, { subscriptionData }) => {
          if (!subscriptionData.data) return prev;
          const { origin, order } = subscriptionData.data.subscriptionZoneOrders;

          if (origin === "new") {
            // Guard: skip already-assigned orders that arrive stale on reconnect
            if (order.rider) return prev;
            // Ring the rider immediately, same as an admin-initiated "call"
            // assignment — a silent add to the list meant the rider only found
            // out about a freshly-PREPARED order by manually opening the "new
            // orders" tab. Only take over the screen if nothing else is
            // already ringing, so a second zone broadcast doesn't interrupt an
            // in-progress accept/reject decision.
            setIncomingOrder((current) => current ?? order);
            return {
              riderOrders: [
                order,
                ...prev.riderOrders.filter((o: IOrder) => o._id !== order._id),
              ],
            };
          } else if (origin === "remove") {
            // Another rider claimed it (or it was cancelled) — stop ringing
            // for an order that's no longer available.
            setIncomingOrder((current) =>
              current?._id === order._id ? null : current,
            );
            return {
              riderOrders: prev.riderOrders.filter((o: IOrder) => o._id !== order._id),
            };
          }
          return prev;
        },
      });
    }

    return () => {
      if (dataProfile?.riderProfile?.zone?._id) {
        setZoneId(dataProfile?.riderProfile?.zone?._id);
      }
      try { unsubZoneOrder?.(); } catch (err) { console.log("err in unsubZoneOrder", err); }
      try { unsubAssignOrder?.(); } catch (err) { console.log("err in unsubAssignOrder", err); }
    };
    // Depend on the primitive values the subscriptions actually key off of, not
    // the whole `dataProfile` object. RIDER_PROFILE gets refetched by other
    // mutations (e.g. marking an order delivered refetches it too), which
    // returns a new object reference every time even when nothing relevant
    // changed. Depending on the object itself tore down and re-subscribed both
    // GraphQL subscriptions on every such refetch, which could race with the
    // in-flight one and surface a spurious "Not your rider assignment stream"
    // error on the old, already-torn-down observable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    dataProfile?.riderProfile?._id,
    dataProfile?.riderProfile?.available,
    dataProfile?.riderProfile?.zone?._id,
  ]);

  // When riderOrders loads/refreshes, auto-show the incoming call modal for AWAITING_RIDER orders.
  // This covers: notification tap from killed state → app opens → query fires → modal shows.
  useEffect(() => {
    if (!dataAssigned?.riderOrders || incomingOrder) return;
    const pending = (dataAssigned.riderOrders as IOrder[]).find(
      (o) => o.orderStatus === "AWAITING_RIDER"
    );
    if (pending) setIncomingOrder(pending);
  }, [dataAssigned]);

  // When user taps the push notification (background/killed → foreground), refetch to get the pending order.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const type = response.notification.request.content.data?.type;
      if (type === "INCOMING_ORDER" || type === "NEARBY_ORDER") {
        refetchAssigned();
      }
    });
    return () => sub.remove();
  }, []);

  // Register the Expo push token with the backend so the server can send call notifications.
  useEffect(() => {
    if (!userId) return;
    getNotificationToken()
      .then((token) => {
        if (token) {
          registerPushToken({ variables: { token } }).catch(() => {});
        }
      })
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    refetchProfile();
  }, [userId]);

  useEffect(() => {
    if (!userId || loadingProfile || linkAttempted.current) return;
    if (dataProfile?.riderProfile) return;
    linkAttempted.current = true;
    linkRiderAccount()
      .then(async () => {
        // Force Clerk to issue a fresh token with the new publicMetadata.role = "RIDER"
        await session?.getToken({ skipCache: true });
        await client.resetStore();
      })
      .catch(() => {});
  }, [userId, loadingProfile, dataProfile?.riderProfile]);

  const contextValue = useMemo(
    () => ({
      modalVisible,
      riderOrderEarnings,
      setModalVisible,
      setRiderOrderEarnings,
      userId: userId ?? "",
      loadingProfile,
      errorProfile,
      dataProfile: dataProfile?.riderProfile ?? null,
      loadingAssigned,
      errorAssigned,
      assignedOrders: errorAssigned ? [] : dataAssigned?.riderOrders ?? [],
      refetchAssigned,
      refetchProfile,
      networkStatusAssigned,
      requestForegroundPermissionsAsync,
      incomingOrder,
      setIncomingOrder,
    }),
    [
      modalVisible,
      riderOrderEarnings,
      userId,
      loadingProfile,
      errorProfile,
      dataProfile,
      loadingAssigned,
      errorAssigned,
      dataAssigned,
      networkStatusAssigned,
      incomingOrder,
    ],
  );

  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  );
};

export const UserConsumer = UserContext.Consumer;
export const useUserContext = () => useContext(UserContext);
export default UserContext;
