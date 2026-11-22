import { useContext, useEffect, useLayoutEffect, useState } from "react";

import { Ionicons } from "@expo/vector-icons";

import getEnvVars from "@/environment";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useLocationContext } from "../context/global/location.context";
import { useApptheme } from "../context/global/theme.context";
import UserContext from "../context/global/user.context";

const useOrderDetail = () => {
  // Hooks
  const { appTheme } = useApptheme();
  const navigation = useNavigation();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab: string; itemId: string; order: string }>();
  const [tab] = useState(params.tab);
  const [orderID] = useState(params.itemId);
  const { assignedOrders, loadingAssigned } = useContext(UserContext);
  const [order, setOrder] = useState(() => {
    try { return params.order ? JSON.parse(params.order as string) : undefined; } catch { return undefined; }
  });
  const { GOOGLE_MAPS_KEY } = getEnvVars();
  const { location } = useLocationContext();

  const [distance, setDistance] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: null,
      headerTitle: null,
      headerLeft: () => (
        <Ionicons
          onPress={() => router.replace("/(tabs)/home/orders")}
          name="chevron-back"
          size={24}
          color={appTheme.fontMainColor}
        />
      ),
    });
  }, [navigation]);

  useEffect(() => {
    if (!loadingAssigned) {
      const found = assignedOrders?.find((o) => o._id === orderID);
      if (found) setOrder(found); // never overwrite with undefined
    }
  }, [loadingAssigned, assignedOrders]);
  const deliveryAddressPin = {
    label: "Delivery Address",
    location: {
      latitude: +order?.deliveryAddress?.location?.coordinates[1] || 0,
      longitude: +order?.deliveryAddress?.location?.coordinates[0] || 0,
    },
  };
  const restaurantAddressPin = {
    label: "Restaurant Address",
    location: {
      latitude: +order?.restaurant?.location?.coordinates[1] || 0,
      longitude: +order?.restaurant?.location?.coordinates[0] || 0,
    },
  };
  const locationPin = {
    label: "Current Location",
    location: {
      latitude: +location?.latitude || 0,
      longitude: +location?.longitude || 0,
    },
  };

  return {
    locationPin,
    restaurantAddressPin,
    deliveryAddressPin,
    GOOGLE_MAPS_KEY,
    distance,
    setDistance,
    duration,
    setDuration,
    loadingAssigned,
    navigation,
    orderID,
    order,
    tab,
  };
};

export default useOrderDetail;
