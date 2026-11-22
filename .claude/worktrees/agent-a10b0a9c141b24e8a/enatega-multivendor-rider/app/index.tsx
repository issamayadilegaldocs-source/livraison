import { useAuth } from "@clerk/clerk-expo";
import { useApolloClient } from "@apollo/client";
import * as Notifications from "expo-notifications";
import { Href, useRouter } from "expo-router";
import { useCallback, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { RIDER_ORDERS } from "@/lib/apollo/queries";
import { ROUTES } from "@/lib/utils/constants";
import { IOrder } from "@/lib/utils/interfaces/order.interface";

function App() {
  const client = useApolloClient();
  const router = useRouter();
  const { isSignedIn } = useAuth();

  const registerForPushNotification = async () => {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus === "granted") {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: false,
          shouldShowBanner: false,
          shouldShowList: false,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });
    }
  };

  const handleNotification = useCallback(
    async (response: Notifications.NotificationResponse) => {
      if (!response?.notification?.request?.content?.data) return;

      const { _id } = response.notification.request.content.data as {
        _id: string;
      };
      const { data } = await client.query({
        query: RIDER_ORDERS,
        fetchPolicy: "network-only",
      });
      const order = data.riderOrders.find((o: IOrder) => o._id === _id);
      const lastHandledId = await AsyncStorage.getItem(
        "@lastNotificationHandledId"
      );
      if (lastHandledId === _id) return;
      await AsyncStorage.setItem("@lastNotificationHandledId", _id);

      router.navigate("/order-detail");
      router.setParams({ itemId: _id, order });
    },
    [client, router]
  );

  useEffect(() => {
    const subscription =
      Notifications.addNotificationResponseReceivedListener(handleNotification);
    return () => subscription.remove();
  }, [handleNotification]);

  useEffect(() => {
    registerForPushNotification();
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: false,
        shouldShowBanner: false,
        shouldShowList: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  }, []);

  useEffect(() => {
    if (isSignedIn === undefined) return;
    if (isSignedIn) {
      router.replace(ROUTES.home as Href);
    } else {
      router.replace(ROUTES.login as Href);
    }
  }, [isSignedIn]);

  return null;
}

export default App;
