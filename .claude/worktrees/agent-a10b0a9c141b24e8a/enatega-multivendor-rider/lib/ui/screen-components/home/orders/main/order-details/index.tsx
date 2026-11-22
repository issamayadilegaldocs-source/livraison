/* eslint-disable @typescript-eslint/no-require-imports */
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useFocusEffect } from "expo-router";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import {
  Alert,
  Animated,
  Dimensions,
  Image,
  Linking,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import MapView, {
  LatLng,
  MapStyleElement,
  Marker,
  Polyline,
  PROVIDER_DEFAULT,
  PROVIDER_GOOGLE,
} from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import { Easing } from "react-native-reanimated";

// Methods
import { linkToMapsApp } from "@/lib/utils/methods";
import { safeFitToCoordinates } from "@/lib/utils/safeFitToCoordinates";

// Icons
import Icons from "@expo/vector-icons/MaterialIcons";

// Screen Components
import ItemDetails from "@/lib/ui/screen-components/home/orders/main/item-details";

// Hooks
import useDetails from "@/lib/hooks/useDetail";
import { REJECT_RIDER_ASSIGNMENT } from "@/lib/apollo/mutations/order.mutation";
import { useMutation } from "@apollo/client";
import useOrderDetail from "@/lib/hooks/useOrderDetails";
import { useRiderTracking } from "@/lib/hooks/useRiderTracking";

// Tracking component
import DeliveryItinerary from "@/lib/ui/useable-components/delivery-itinerary";

// Context
import { ConfigurationContext } from "@/lib/context/global/configuration.context";

// UI Components
import { RIDER_ORDERS } from "@/lib/apollo/queries";
import { useApptheme } from "@/lib/context/global/theme.context";
import { useUserContext } from "@/lib/context/global/user.context";
import { CustomContinueButton } from "@/lib/ui/useable-components";
import AccordionItem from "@/lib/ui/useable-components/accordian";
import SpinnerComponent from "@/lib/ui/useable-components/spinner";
import WelldoneComponent from "@/lib/ui/useable-components/well-done";
import PaymentMethodBadge from "@/lib/ui/useable-components/payment-method-badge";
import { CustomMapStyles } from "@/lib/utils/constants/map";
import { map_styles } from "@/lib/utils/constants/order-details";
import { IOrder } from "@/lib/utils/interfaces/order.interface";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { height } = Dimensions.get("window");
const ORDER_DETAIL_SNAP_POINTS = ["50%", "85%"];
const MARKER_ICON_SIZE = { height: 35, width: 32 };
const HOME_MARKER_ICON = require("@/lib/assets/home_icon.png");
const RESTAURANT_MARKER_ICON = require("@/lib/assets/rest_icon.png");

const isValidCoordinate = (coord?: LatLng | null): boolean => {
  if (!coord) return false;
  const { latitude, longitude } = coord;
  return (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    !isNaN(latitude) &&
    !isNaN(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180 &&
    !(latitude === 0 && longitude === 0) // reject null island
  );
};

export default function OrderDetailScreen() {
  // Ref
  const bottomSheetRef = useRef<BottomSheet>(null);
  const mapRef = useRef<MapView>(null);

  // Context
  const configuration = useContext(ConfigurationContext);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const insets = useSafeAreaInsets();

  // Hooks
  const [isFocused, setIsFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, []),
  );
  const { appTheme, currentTheme } = useApptheme();
  const { t } = useTranslation();
  const {
    restaurantAddressPin,
    deliveryAddressPin,
    GOOGLE_MAPS_KEY,
    setDistance,
    setDuration,
    order,
    tab,
    locationPin,
  } = useOrderDetail();
  const { userId } = useUserContext();
  // Initialize directly from order so routes draw on first render (not one cycle late)
  const [localOrder, setLocalOrder] = useState<IOrder>((order ?? {}) as IOrder);
  const {
    mutateAssignOrder,
    mutateOrderStatus,
    mutateOrderArrived,
    loadingOrderStatus,
    loadingOrderArrived,
  } = useDetails(order);

  const [mutateRejectAssignment, { loading: loadingReject }] = useMutation(
    REJECT_RIDER_ASSIGNMENT,
    { refetchQueries: [{ query: RIDER_ORDERS }] },
  );

  // States
  const [customMapStyles, setCustomMapStyles] = useState<MapStyleElement[]>();
  const [orderId, setOrderId] = useState("");
  const [etaToRestaurant, setEtaToRestaurant] = useState<number | null>(null);
  const [distToRestaurant, setDistToRestaurant] = useState<number | null>(null);
  const [etaToCustomer, setEtaToCustomer] = useState<number | null>(null);
  const [distToCustomer, setDistToCustomer] = useState<number | null>(null);
  const [bottomSheetIndex, setBottomSheetIndex] = useState(0);
  const [routeOrigin, setRouteOrigin] = useState<LatLng | null>(null);
  // Fallback straight-line polylines when GMAPS returns ZERO_RESULTS
  const [fallbackRiderToRestaurant, setFallbackRiderToRestaurant] = useState<
    LatLng[] | null
  >(null);
  const [fallbackRiderToCustomer, setFallbackRiderToCustomer] = useState<
    LatLng[] | null
  >(null);
  const [fallbackRestaurantToCustomer, setFallbackRestaurantToCustomer] =
    useState<LatLng[] | null>(null);

  const isActiveDelivery =
    localOrder?.orderStatus === "ASSIGNED" ||
    localOrder?.orderStatus === "PICKED" ||
    localOrder?.orderStatus === "ARRIVED";
  const { breadcrumbTrail } = useRiderTracking(isActiveDelivery);

  const edgePadding = useMemo(
    () => ({ top: 100, right: 70, bottom: 140, left: 70 }),
    [],
  );
  const routeFitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const restaurantLocation = useMemo<LatLng | null>(() => {
    const coord = restaurantAddressPin?.location;
    return isValidCoordinate(coord)
      ? { latitude: coord.latitude, longitude: coord.longitude }
      : null;
  }, [
    restaurantAddressPin?.location?.latitude,
    restaurantAddressPin?.location?.longitude,
  ]);

  const deliveryLocation = useMemo<LatLng | null>(() => {
    const coord = deliveryAddressPin?.location;
    return isValidCoordinate(coord)
      ? { latitude: coord.latitude, longitude: coord.longitude }
      : null;
  }, [
    deliveryAddressPin?.location?.latitude,
    deliveryAddressPin?.location?.longitude,
  ]);

  const riderLocation = useMemo<LatLng | null>(() => {
    const coord = locationPin?.location;
    return isValidCoordinate(coord)
      ? { latitude: coord.latitude, longitude: coord.longitude }
      : null;
  }, [locationPin?.location?.latitude, locationPin?.location?.longitude]);

  const initialMapRegion = useMemo(() => {
    const initialCoordinate = restaurantLocation ?? deliveryLocation;
    if (!initialCoordinate) return undefined;

    return {
      latitude: initialCoordinate.latitude,
      longitude: initialCoordinate.longitude,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
  }, [restaurantLocation, deliveryLocation]);

  // When called with actual route polyline coords, use those (most accurate).
  // Otherwise fall back to the 3 marker positions, filtering out {0,0}.
  const fitMapToRoute = useCallback(
    (routeCoords?: LatLng[]) => {
      if (routeCoords && routeCoords.length >= 2) {
        safeFitToCoordinates(mapRef, routeCoords, {
          edgePadding,
          animated: true,
        });
        return;
      }
      const coords = [
        restaurantLocation,
        deliveryLocation,
        riderLocation,
      ].filter(isValidCoordinate) as LatLng[];
      if (coords.length === 0) return;
      safeFitToCoordinates(mapRef, coords, { edgePadding, animated: true });
    },
    [restaurantLocation, deliveryLocation, riderLocation, edgePadding],
  );

  const scheduleFitMapToRoute = useCallback(
    (routeCoords?: LatLng[], delay = 250) => {
      if (routeFitTimeoutRef.current) {
        clearTimeout(routeFitTimeoutRef.current);
      }

      routeFitTimeoutRef.current = setTimeout(() => {
        fitMapToRoute(routeCoords);
        routeFitTimeoutRef.current = null;
      }, delay);
    },
    [fitMapToRoute],
  );

  // Re-fit and reset fallbacks whenever the active leg changes.
  // Keep the route origin stable for the leg so Directions does not redraw on
  // every live rider location update; the animated rider marker still moves.
  useEffect(() => {
    if (!isFocused) return;
    // Clear fallbacks so MapViewDirections gets a fresh attempt on each status change
    setFallbackRiderToRestaurant(null);
    setFallbackRiderToCustomer(null);
    setFallbackRestaurantToCustomer(null);
    setRouteOrigin(riderLocation);
    scheduleFitMapToRoute(undefined, 400);
  }, [localOrder?.orderStatus, isFocused]);

  useEffect(() => {
    if (!routeOrigin && riderLocation) {
      setRouteOrigin(riderLocation);
    }
  }, [routeOrigin, riderLocation]);

  // Ref
  const latitude = useRef(
    new Animated.Value(locationPin.location.latitude),
  ).current;
  const longitude = useRef(
    new Animated.Value(locationPin.location.longitude),
  ).current;
  const waveAnimation = useRef(new Animated.Value(0)).current; // Wave animation value

  // Handler
  const moveMarker = (newLocation: LatLng) => {
    // Safety check for valid coordinates before starting animation
    // This prevents trying to animate to invalid coordinates which could cause crashes
    if (!isValidCoordinate(newLocation)) {
      console.warn("Attempted to move marker to invalid location", newLocation);
      return;
    }

    // Use a single animation group to prevent potential race conditions
    // This prevents array index issues by ensuring animations stay in sync
    Animated.parallel([
      Animated.timing(latitude, {
        toValue: newLocation.latitude,
        duration: 2000,
        useNativeDriver: false,
      }),
      Animated.timing(longitude, {
        toValue: newLocation.longitude,
        duration: 2000,
        useNativeDriver: false,
      }),
    ]).start();
  };

  useEffect(() => {
    return () => {
      // Clean up any pending retry timeouts
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      if (routeFitTimeoutRef.current) {
        clearTimeout(routeFitTimeoutRef.current);
        routeFitTimeoutRef.current = null;
      }
    };
  }, []);

  // One-tap Google Maps directions to a single destination (restaurant or
  // customer). Uses the universal Maps URL so it opens the Google Maps app on
  // Android/iOS and the website on web.
  const openDirectionsTo = (destination: LatLng | null) => {
    if (!destination) {
      if (Platform.OS === "web") {
        (globalThis as any).alert?.(t("locationUnavailable"));
      } else {
        Alert.alert(t("Navigation Error"), t("locationUnavailable"));
      }
      return;
    }
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}&travelmode=driving`;
    Linking.openURL(url).catch(() => {
      Alert.alert(t("Navigation Error"), t("Could not open maps application"));
    });
  };

  const openMaps = () => {
    try {
      // Validate all required coordinates to prevent app crashes
      // when trying to construct navigation URLs with invalid data
      if (!riderLocation) {
        console.log("Invalid rider location for maps navigation");
        Alert.alert(t("Navigation Error"), t("Rider location is unavailable."));
        return;
      }

      if (!restaurantLocation) {
        console.log("Invalid store location for maps navigation");
        Alert.alert(
          t("Navigation Error"),
          t("Restaurant location is unavailable."),
        );
        return;
      }

      if (!deliveryLocation) {
        console.log("Invalid customer location for maps navigation");
        Alert.alert(
          t("Navigation Error"),
          t("Delivery location is unavailable."),
        );
        return;
      }

      const rider = `${riderLocation.latitude},${riderLocation.longitude}`;
      const store = `${restaurantLocation.latitude},${restaurantLocation.longitude}`;
      const customer = `${deliveryLocation.latitude},${deliveryLocation.longitude}`;

      if (Platform.OS === "ios") {
        // Apple Maps (Only Rider -> Store -> Customer)
        const appleMapsUrl = `maps://app?saddr=${rider}&daddr=${localOrder?.orderStatus === "PICKED" ? customer : store}`;
        // Added error handling for Linking
        Linking.openURL(appleMapsUrl).catch(() => {
          Alert.alert(
            t("Navigation Error"),
            t("Could not open maps application"),
          );
        });
      } else {
        // Google Maps (Supports waypoints: Rider -> Store -> Customer)
        const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${rider}&destination=${customer}&waypoints=${store}`;
        // Added error handling for Linking
        Linking.openURL(googleMapsUrl).catch(() => {
          Alert.alert(
            t("Navigation Error"),
            t("Could not open maps application"),
          );
        });
      }
    } catch (error) {
      // Added global error handling
      console.log("Error opening maps:", error);
      Alert.alert(
        t("Navigation Error"),
        t("An error occurred when trying to open maps"),
      );
    }
  };

  // Use Effect
  useEffect(() => {
    const styles_for_map = CustomMapStyles(appTheme);
    if (currentTheme && appTheme) {
      setCustomMapStyles(styles_for_map);
    }

    // Added validation for Google Maps API key to catch common configuration issues
    if (!GOOGLE_MAPS_KEY || GOOGLE_MAPS_KEY === "") {
      console.log("Google Maps API key is missing or invalid");
    }
  }, [appTheme, currentTheme, GOOGLE_MAPS_KEY]);

  useEffect(() => {
    // Only set up the animation if locationPin.location exists and is valid
    // This prevents trying to animate when location data is invalid
    if (!locationPin?.location || !isValidCoordinate(locationPin.location)) {
      console.warn("Location pin is invalid or missing:", locationPin);
      return;
    }

    // Don't start animations/intervals when screen is not visible
    if (!isFocused) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    try {
      // Safely initialize marker position before starting animations
      // This prevents issues with undefined initial values
      const initialLatitude = locationPin.location.latitude;
      const initialLongitude = locationPin.location.longitude;

      // Initial positioning (without animation)
      latitude.setValue(initialLatitude);
      longitude.setValue(initialLongitude);

      // Start periodic updates with proper error handling
      intervalId = setInterval(() => {
        if (
          !locationPin?.location ||
          !isValidCoordinate(locationPin.location)
        ) {
          console.warn("Skipping marker update due to invalid location data");
          return;
        }

        const newLatitude = locationPin.location.latitude;
        const newLongitude = locationPin.location.longitude;
        moveMarker({ latitude: newLatitude, longitude: newLongitude });
      }, 5000);

      // Start wave animation
      const animation = Animated.loop(
        Animated.timing(waveAnimation, {
          toValue: 1000,
          duration: 10000,
          useNativeDriver: true,
          easing: Easing.linear,
        }),
      );

      animation.start();

      return () => {
        // Proper cleanup to prevent animation continuing after unmount
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
        animation.stop();
      };
    } catch (error) {
      // Error handling to prevent uncaught exceptions
      console.log("Error in location animation setup:", error);
      if (intervalId) {
        clearInterval(intervalId);
      }
      return () => {};
    }
    // Only run when screen is focused and location changes
  }, [
    locationPin?.location?.latitude,
    locationPin?.location?.longitude,
    isFocused,
  ]);

  useEffect(() => {
    if (order) {
      setLocalOrder(order);
    }
  }, [order]);

  if (!localOrder) return;

  const stableRouteOrigin = routeOrigin ?? riderLocation;

  return (
    <>
      <GestureHandlerRootView
        className="flex-1"
        style={{ backgroundColor: appTheme.themeBackground, height: "100%" }}
      >
        <View
          style={{
            height: height * 0.5,
            backgroundColor: "transparent",
          }}
        >
          {/* <Button title="Open in Maps" onPress={openMaps} /> */}
          <View
            style={{
              alignItems: "center",
              justifyContent: "center",

              width: 38,
              backgroundColor: appTheme.themeBackground,
              opacity: 0.75,
              position: "absolute",
              top: 60,
              right: 12,
              zIndex: 1,
            }}
          >
            <TouchableOpacity onPress={openMaps}>
              <Icons
                name="navigation"
                size={30}
                color="#1f2937"
                className={appTheme.fontMainColor}
              />
            </TouchableOpacity>
          </View>

          {/* Floating next-step banner — visible only during active delivery */}
          {bottomSheetIndex === 0 &&
            (localOrder?.orderStatus === "ASSIGNED" ||
              localOrder?.orderStatus === "PICKED") && (
              <View
                style={{
                  position: "absolute",
                  bottom: 16,
                  left: 16,
                  right: 16,
                  backgroundColor: appTheme.themeBackground,
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  flexDirection: "row",
                  alignItems: "center",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.15,
                  shadowRadius: 6,
                  elevation: 5,
                  zIndex: 1,
                }}
              >
                <Icons
                  name={localOrder?.orderStatus === "PICKED" ? "home" : "store"}
                  size={22}
                  color={appTheme.primary}
                  style={{ marginRight: 10 }}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "700",
                      color: appTheme.fontMainColor,
                    }}
                    numberOfLines={1}
                  >
                    {localOrder?.orderStatus === "PICKED"
                      ? localOrder?.deliveryAddress?.deliveryAddress
                      : localOrder?.restaurant?.name}
                  </Text>
                  {(localOrder?.orderStatus === "ASSIGNED"
                    ? etaToRestaurant
                    : etaToCustomer) !== null && (
                    <Text
                      style={{ fontSize: 12, color: appTheme.fontSecondColor }}
                    >
                      {t("Arriving in")} ~
                      {Math.round(
                        (localOrder?.orderStatus === "ASSIGNED"
                          ? etaToRestaurant
                          : etaToCustomer) ?? 0,
                      )}{" "}
                      {t("min")}
                    </Text>
                  )}
                </View>
              </View>
            )}
          {GOOGLE_MAPS_KEY && initialMapRegion ? (
            <MapView
              ref={mapRef}
              style={{ width: "100%", height: "100%" }}
              customMapStyle={customMapStyles}
              provider={
                Platform.OS === "android" ? PROVIDER_GOOGLE : PROVIDER_DEFAULT
              }
              zoomEnabled={true}
              zoomControlEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
              showsCompass={false}
              showsMyLocationButton={false}
              showsTraffic={false}
              toolbarEnabled={false}
              moveOnMarkerPress={false}
              initialRegion={initialMapRegion}
              onMapReady={() => scheduleFitMapToRoute(undefined, 0)}
            >
              {deliveryLocation && (
                <Marker
                  coordinate={deliveryLocation}
                  title={t("deliveryAddress")}
                  image={HOME_MARKER_ICON}
                  onPress={() => {
                    linkToMapsApp(deliveryLocation, deliveryAddressPin.label);
                  }}
                />
              )}
              {restaurantLocation && (
                <Marker
                  coordinate={restaurantLocation}
                  title={t("Restaurant")}
                  image={RESTAURANT_MARKER_ICON}
                  onPress={() => {
                    linkToMapsApp(
                      restaurantLocation,
                      restaurantAddressPin.label,
                    );
                  }}
                />
              )}
              {/* Added multiple validation checks for rider marker to prevent array index errors */}
              {riderLocation && (
                <Marker.Animated
                  coordinate={{ latitude, longitude }}
                  title="Rider"
                  description={t("thisIsRiderSLocation")}
                  onPress={() => {
                    if (riderLocation) {
                      linkToMapsApp(riderLocation, locationPin.label);
                    }
                  }}
                >
                  <Image
                    source={require("@/lib/assets/rider_icon.png")}
                    style={MARKER_ICON_SIZE}
                  />
                </Marker.Animated>
              )}

              {/* Route: Rider → Restaurant (ACCEPTED / ASSIGNED / AWAITING_RIDER) */}
              {(localOrder?.orderStatus === "ACCEPTED" ||
                localOrder?.orderStatus === "ASSIGNED" ||
                localOrder?.orderStatus === "AWAITING_RIDER") &&
                stableRouteOrigin &&
                restaurantLocation &&
                GOOGLE_MAPS_KEY && (
                  <MapViewDirections
                    origin={stableRouteOrigin}
                    destination={restaurantLocation}
                    apikey={GOOGLE_MAPS_KEY}
                    mode="DRIVING"
                    strokeWidth={5}
                    strokeColor={appTheme.primary ?? "#f95509"}
                    lineCap="round"
                    lineJoin="round"
                    precision="high"
                    optimizeWaypoints={false}
                    resetOnChange={false}
                    onReady={(results) => {
                      setDistance(results.distance);
                      setDuration(results.duration);
                      setDistToRestaurant(results.distance);
                      setEtaToRestaurant(results.duration);
                      scheduleFitMapToRoute(results.coordinates, 0);
                    }}
                    onError={(error) => {
                      console.log("Route error (rider→restaurant):", error);
                      // Draw straight line when no road route found
                      if (riderLocation && restaurantLocation) {
                        const fallbackRoute = [
                          riderLocation,
                          restaurantLocation,
                        ];
                        setFallbackRiderToRestaurant(fallbackRoute);
                        scheduleFitMapToRoute(fallbackRoute, 0);
                      }
                    }}
                  />
                )}

              {/* Route: Rider → Customer (PICKED / ARRIVED) */}
              {(localOrder?.orderStatus === "PICKED" ||
                localOrder?.orderStatus === "ARRIVED") &&
                stableRouteOrigin &&
                deliveryLocation &&
                GOOGLE_MAPS_KEY && (
                  <MapViewDirections
                    origin={stableRouteOrigin}
                    destination={deliveryLocation}
                    apikey={GOOGLE_MAPS_KEY}
                    mode="DRIVING"
                    strokeWidth={5}
                    strokeColor={appTheme.primary ?? "#f95509"}
                    lineCap="round"
                    lineJoin="round"
                    precision="high"
                    optimizeWaypoints={false}
                    resetOnChange={false}
                    onReady={(result) => {
                      setDistance(result.distance);
                      setDuration(result.duration);
                      setDistToCustomer(result.distance);
                      setEtaToCustomer(result.duration);
                      scheduleFitMapToRoute(result.coordinates, 0);
                    }}
                    onError={(error) => {
                      console.log("Route error (rider→customer):", error);
                      if (riderLocation && deliveryLocation) {
                        const fallbackRoute = [riderLocation, deliveryLocation];
                        setFallbackRiderToCustomer(fallbackRoute);
                        scheduleFitMapToRoute(fallbackRoute, 0);
                      }
                    }}
                  />
                )}

              {/* Route: Restaurant → Customer
                  Shown when GPS unavailable (rider position unknown)
                  OR when order is in a terminal/viewing state */}
              {(!riderLocation ||
                (localOrder?.orderStatus !== "ACCEPTED" &&
                  localOrder?.orderStatus !== "PICKED" &&
                  localOrder?.orderStatus !== "ARRIVED" &&
                  localOrder?.orderStatus !== "ASSIGNED" &&
                  localOrder?.orderStatus !== "AWAITING_RIDER")) &&
                restaurantLocation &&
                deliveryLocation &&
                GOOGLE_MAPS_KEY && (
                  <MapViewDirections
                    origin={restaurantLocation}
                    destination={deliveryLocation}
                    apikey={GOOGLE_MAPS_KEY}
                    mode="DRIVING"
                    strokeWidth={4}
                    strokeColor="#9CA3AF"
                    lineCap="round"
                    lineJoin="round"
                    precision="high"
                    optimizeWaypoints={false}
                    resetOnChange={false}
                    onReady={(result) => {
                      setDistance(result.distance);
                      setDuration(result.duration);
                      scheduleFitMapToRoute(result.coordinates, 0);
                    }}
                    onError={(error) => {
                      console.log("Route error (restaurant→customer):", error);
                      if (restaurantLocation && deliveryLocation) {
                        const fallbackRoute = [
                          restaurantLocation,
                          deliveryLocation,
                        ];
                        setFallbackRestaurantToCustomer(fallbackRoute);
                        scheduleFitMapToRoute(fallbackRoute, 0);
                      }
                    }}
                  />
                )}
              {/* Fallback straight lines when GMAPS returns ZERO_RESULTS */}
              {fallbackRiderToRestaurant && (
                <Polyline
                  coordinates={fallbackRiderToRestaurant}
                  strokeColor={appTheme.primary ?? "#f95509"}
                  strokeWidth={3}
                  lineDashPattern={[6, 4]}
                />
              )}
              {fallbackRiderToCustomer && (
                <Polyline
                  coordinates={fallbackRiderToCustomer}
                  strokeColor={appTheme.primary ?? "#f95509"}
                  strokeWidth={3}
                  lineDashPattern={[6, 4]}
                />
              )}
              {fallbackRestaurantToCustomer && (
                <Polyline
                  coordinates={fallbackRestaurantToCustomer}
                  strokeColor="#9CA3AF"
                  strokeWidth={3}
                  lineDashPattern={[6, 4]}
                />
              )}

              {/* Breadcrumb trail — path already traveled by the rider */}
              {breadcrumbTrail.length >= 2 && (
                <Polyline
                  coordinates={breadcrumbTrail}
                  strokeColor="#9CA3AF"
                  strokeWidth={3}
                  lineDashPattern={[4, 4]}
                />
              )}
              {/* <Button title="Open in Maps" onPress={openMaps} /> */}
            </MapView>
          ) : (
            <View className="flex-1 justify-center items-center gap-y-3">
              <Text className="text-3xl">{t("mapNotLoaded")}</Text>
              <Text
                className="text-lg "
                style={{ color: appTheme.fontSecondColor }}
              >
                {t("pleaseCheckForPermissions")}
              </Text>
            </View>
          )}
        </View>

        <BottomSheet
          ref={bottomSheetRef}
          index={0}
          snapPoints={ORDER_DETAIL_SNAP_POINTS}
          backgroundStyle={map_styles.backgroundStyle}
          animateOnMount={true}
          handleIndicatorStyle={{ backgroundColor: appTheme.borderLineColor }}
          enableOverDrag={false}
          enableContentPanningGesture={true}
          onChange={setBottomSheetIndex}
        >
          <BottomSheetScrollView
            contentContainerStyle={{
              padding: 12,
              backgroundColor: appTheme.themeBackground,
            }}
            showsVerticalScrollIndicator={false}
            style={{
              flex: 1,
              backgroundColor: appTheme.themeBackground,
              borderWidth: 1,
              borderColor: appTheme.borderLineColor,
              borderRadius: 12,
            }}
          >
            {/* Live itinerary — shown when the rider is on an active delivery */}
            {(localOrder?.orderStatus === "ASSIGNED" ||
              localOrder?.orderStatus === "PICKED" ||
              localOrder?.orderStatus === "ARRIVED" ||
              localOrder?.orderStatus === "DELIVERED") && (
              <DeliveryItinerary
                restaurantName={localOrder?.restaurant?.name ?? ""}
                deliveryAddress={
                  localOrder?.deliveryAddress?.deliveryAddress ?? ""
                }
                etaToRestaurant={etaToRestaurant}
                distanceToRestaurant={distToRestaurant}
                etaToCustomer={etaToCustomer}
                distanceToCustomer={distToCustomer}
                orderStatus={localOrder?.orderStatus ?? ""}
              />
            )}

            {/* Order ID + Status */}
            <View className="flex-row justify-between items-center mb-4">
              <Text
                className="font-bold"
                style={{ color: appTheme.fontSecondColor }}
              >
                {t("orderID")} #{localOrder?.orderId ?? "-"}
              </Text>
              <View
                className="px-3 py-1 rounded-xl"
                style={{
                  backgroundColor:
                    localOrder?.orderStatus === "ASSIGNED"
                      ? "#FEF3C7"
                      : localOrder?.orderStatus === "PICKED"
                        ? "#D1FAE5"
                        : localOrder?.orderStatus === "ARRIVED"
                          ? "#DBEAFE"
                          : localOrder?.orderStatus === "AWAITING_RIDER"
                            ? "#FEF9C3"
                            : "#E0E7FF",
                }}
              >
                <Text
                  className="text-xs font-semibold"
                  style={{
                    color:
                      localOrder?.orderStatus === "ASSIGNED"
                        ? "#D97706"
                        : localOrder?.orderStatus === "PICKED"
                          ? "#059669"
                          : localOrder?.orderStatus === "ARRIVED"
                            ? "#2563EB"
                            : localOrder?.orderStatus === "AWAITING_RIDER"
                              ? "#CA8A04"
                              : "#4F46E5",
                  }}
                >
                  {localOrder?.orderStatus ?? "-"}
                </Text>
              </View>
            </View>

            {/* Restaurant */}
            <View className="flex-1 flex-row justify-start items-center gap-x-4 mb-4">
              <Image
                source={
                  localOrder?.restaurant?.image
                    ? { uri: localOrder?.restaurant?.image }
                    : require("../../../../../../assets/images/placeholder.jpg")
                }
                style={{ width: 36, height: 36, borderRadius: 8 }}
              />
              {localOrder?.restaurant?.name && (
                <Text
                  className="font-[Inter] text-lg font-bold"
                  style={{ color: appTheme.fontMainColor }}
                >
                  {localOrder?.restaurant?.name}
                </Text>
              )}
            </View>

            {/* Pick Up → Delivery address route */}
            <View className="mb-4 gap-y-3">
              {/* Pickup */}
              <View className="flex-row items-start gap-x-3">
                <View
                  className="w-3 h-3 rounded-full mt-1"
                  style={{ backgroundColor: "#F97316" }}
                />
                <View className="flex-1">
                  <Text
                    className="text-xs font-semibold mb-0.5"
                    style={{ color: appTheme.fontSecondColor }}
                  >
                    {t("Pickup")}
                  </Text>
                  <Text
                    className="text-sm font-medium"
                    style={{ color: appTheme.fontMainColor }}
                  >
                    {localOrder?.restaurant?.address ?? "-"}
                  </Text>
                </View>
              </View>

              {/* Dotted connector */}
              <View
                className="ml-1.5 h-4 border-l-2 border-dashed"
                style={{ borderColor: appTheme.borderLineColor }}
              />

              {/* Delivery */}
              <View className="flex-row items-start gap-x-3">
                <View
                  className="w-3 h-3 rounded-full mt-1"
                  style={{ backgroundColor: "#10B981" }}
                />
                <View className="flex-1">
                  <Text
                    className="text-xs font-semibold mb-0.5"
                    style={{ color: appTheme.fontSecondColor }}
                  >
                    {t("Delivery")}
                  </Text>
                  <Text
                    className="text-sm font-medium"
                    style={{ color: appTheme.fontMainColor }}
                  >
                    {localOrder?.deliveryAddress?.deliveryAddress ?? "-"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Google Maps itineraries — restaurant & customer */}
            <View className="flex-row gap-x-3 mb-4">
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t("restaurantDirections")}
                className="flex-1 flex-row items-center justify-center gap-x-2 rounded-xl py-3"
                style={{
                  borderWidth: 1,
                  borderColor: appTheme.primary,
                  backgroundColor: appTheme.themeBackground,
                }}
                onPress={() => openDirectionsTo(restaurantLocation)}
              >
                <Icons name="store" size={18} color={appTheme.primary} />
                <Text
                  className="text-sm font-semibold"
                  style={{ color: appTheme.primary }}
                >
                  {t("restaurantDirections")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t("customerDirections")}
                className="flex-1 flex-row items-center justify-center gap-x-2 rounded-xl py-3"
                style={{
                  borderWidth: 1,
                  borderColor: "#10B981",
                  backgroundColor: appTheme.themeBackground,
                }}
                onPress={() => openDirectionsTo(deliveryLocation)}
              >
                <Icons name="home" size={18} color="#10B981" />
                <Text
                  className="text-sm font-semibold"
                  style={{ color: "#10B981" }}
                >
                  {t("customerDirections")}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Payment Method */}
            <View className="flex-1 flex-row justify-between items-center mb-4">
              <Text
                className="font-[Inter] text-[16px] text-base font-[500]"
                style={{ color: appTheme.fontSecondColor }}
              >
                {t("paymentMethod")}
              </Text>
              <PaymentMethodBadge
                paymentMethod={localOrder?.paymentMethod}
                size="sm"
              />
            </View>

            {/* Order Amount */}
            <View className="w-[99%] flex-row justify-between">
              <Text
                className="flex-1 font-[Inter] text-[16px] text-base font-[500] "
                style={{ color: appTheme.fontSecondColor }}
              >
                {t("orderAmount")}
              </Text>

              <Text
                className="flex-1 font-[Inter] font-semibold text-right "
                style={{ color: appTheme.fontMainColor }}
              >
                {configuration?.currencySymbol}
                {localOrder?.orderAmount}
                {localOrder.paymentStatus === "PAID"
                  ? t("Paid")
                  : t("notPaidYet")}
              </Text>
            </View>

            {/* Divider */}
            <View className="flex-1 h-[1px] mb-4" />

            <AccordionItem title={t("orderDetails")}>
              <ItemDetails orderData={localOrder} tab={tab} />
            </AccordionItem>

            {/* AWAITING_RIDER — Accept / Reject buttons */}
            {tab === "processing" &&
              localOrder.orderStatus === "AWAITING_RIDER" && (
                <View
                  style={{
                    gap: 12,
                    marginTop: 16,
                    marginBottom: 10,
                    paddingBottom:
                      Platform.OS === "ios"
                        ? insets.bottom
                        : insets.bottom + 10,
                  }}
                >
                  <Text
                    className="text-center font-semibold"
                    style={{ color: appTheme.fontSecondColor }}
                  >
                    {t("Admin assigned this order to you")}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        backgroundColor: "#EF4444",
                        borderRadius: 24,
                        paddingVertical: 14,
                        alignItems: "center",
                      }}
                      disabled={loadingReject || loadingOrderStatus}
                      onPress={() =>
                        mutateRejectAssignment({
                          variables: { id: localOrder?._id },
                        })
                      }
                    >
                      {loadingReject ? (
                        <SpinnerComponent color="white" />
                      ) : (
                        <Text className="text-white font-bold text-base">
                          {t("Reject")}
                        </Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        backgroundColor: "#22C55E",
                        borderRadius: 24,
                        paddingVertical: 14,
                        alignItems: "center",
                      }}
                      disabled={loadingOrderStatus || loadingReject}
                      onPress={() =>
                        mutateOrderStatus({
                          variables: {
                            id: localOrder?._id,
                            status: "ASSIGNED",
                          },
                        })
                      }
                    >
                      {loadingOrderStatus ? (
                        <SpinnerComponent color="white" />
                      ) : (
                        <Text className="text-white font-bold text-base">
                          {t("Accept")}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

            {/* Pick up Button */}
            {tab === "processing" && localOrder.orderStatus === "ASSIGNED" && (
              <TouchableOpacity
                className="h-14 rounded-3xl py-3 w-full mt-4 mb-10"
                style={{ backgroundColor: appTheme.primary }}
                disabled={loadingOrderStatus}
                onPress={() =>
                  mutateOrderStatus({
                    variables: { id: localOrder?._id, status: "PICKED" },
                  })
                }
              >
                {loadingOrderStatus ? (
                  <SpinnerComponent />
                ) : (
                  <Text
                    className="text-center  text-lg font-medium"
                    style={{ color: appTheme.black }}
                  >
                    {t("pickUp")}
                  </Text>
                )}
              </TouchableOpacity>
            )}

            {/* Arrived Button */}
            {tab === "processing" && localOrder.orderStatus === "PICKED" && (
              <TouchableOpacity
                className="h-14 rounded-3xl py-3 w-full mt-4 mb-10"
                style={{ backgroundColor: appTheme.primary }}
                disabled={loadingOrderArrived}
                accessibilityRole="button"
                accessibilityLabel={t("arrived")}
                onPress={() =>
                  mutateOrderArrived({
                    variables: { id: localOrder?._id },
                  })
                }
              >
                {loadingOrderArrived ? (
                  <SpinnerComponent />
                ) : (
                  <Text
                    className="text-center  text-lg font-medium"
                    style={{ color: appTheme.black }}
                  >
                    {t("arrived")}
                  </Text>
                )}
              </TouchableOpacity>
            )}

            {tab == "processing" &&
              localOrder.orderStatus === "ARRIVED" &&
              (localOrder.riderDeliveredAt ? (
                /* Rider already confirmed — waiting for customer */
                <View
                  style={{
                    marginTop: 16,
                    marginBottom: 10,
                    paddingBottom:
                      Platform.OS === "ios"
                        ? insets.bottom
                        : insets.bottom + 10,
                    backgroundColor: "#FEF9C3",
                    borderRadius: 12,
                    padding: 16,
                    alignItems: "center",
                  }}
                >
                  <Icons
                    name="hourglass-empty"
                    size={28}
                    color="#CA8A04"
                    style={{ marginBottom: 6 }}
                  />
                  <Text
                    style={{
                      color: "#92400E",
                      fontWeight: "700",
                      fontSize: 15,
                      textAlign: "center",
                    }}
                  >
                    {t("Waiting for customer confirmation")}
                  </Text>
                  <Text
                    style={{
                      color: "#B45309",
                      fontSize: 12,
                      textAlign: "center",
                      marginTop: 4,
                    }}
                  >
                    {t(
                      "Your delivery has been submitted. Waiting for the customer to confirm receipt.",
                    )}
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  className="h-14 rounded-3xl py-3 w-full mt-4 mb-10"
                  style={{ backgroundColor: appTheme.primary }}
                  disabled={loadingOrderStatus}
                  onPress={() => {
                    const isCOD = localOrder?.paymentMethod === "COD";
                    const doDeliver = async (codCollected?: boolean) => {
                      await mutateOrderStatus({
                        variables: {
                          id: localOrder?._id,
                          status: "DELIVERED",
                          ...(codCollected !== undefined
                            ? { codCollected }
                            : {}),
                        },
                        onCompleted: () => {
                          setOrderId(localOrder?.orderId);
                        },
                      });
                      setOrderId(localOrder?.orderId);
                    };
                    if (isCOD) {
                      const message = `${t("Did you collect")} ${configuration?.currencySymbol}${localOrder?.orderAmount} ${t("in cash from the customer?")}`;
                      if (Platform.OS === "web") {
                        // Alert.alert has no native dialog on web, so confirm via window.confirm instead.
                        if (window.confirm(`${t("Cash Collection")}\n${message}`)) {
                          doDeliver(true);
                        }
                      } else {
                        Alert.alert(t("Cash Collection"), message, [
                          { text: t("Cancel"), style: "cancel" },
                          {
                            text: t("Yes, collected"),
                            onPress: () => doDeliver(true),
                          },
                        ]);
                      }
                    } else {
                      doDeliver();
                    }
                  }}
                >
                  {loadingOrderStatus ? (
                    <SpinnerComponent color="white" />
                  ) : (
                    <Text
                      className="text-center text-lg font-medium"
                      style={{ color: appTheme.black }}
                    >
                      {t("markAsDelivered")}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}

            {tab === "new_orders" &&
              ["ACCEPTED", "PREPARED"].includes(
                localOrder.orderStatus ?? "",
              ) && (
              <View
                style={{
                  paddingBottom:
                    Platform.OS === "ios" ? insets.bottom : insets.bottom + 10,
                }}
              >
                <CustomContinueButton
                  title={t("assignMe")}
                  className="w-[55%] mx-auto"
                  onPress={() =>
                    mutateAssignOrder({
                      variables: { id: localOrder?._id },
                      refetchQueries: [
                        {
                          query: RIDER_ORDERS,
                          variables: { userId: userId },
                        },
                      ],
                    })
                  }
                />
              </View>
            )}
          </BottomSheetScrollView>
        </BottomSheet>
      </GestureHandlerRootView>
      {
        <WelldoneComponent
          orderId={orderId}
          setOrderId={setOrderId}
          status={localOrder?.orderStatus === "DELIVERED" ? "Delivered" : ""}
        />
      }
    </>
  );
}
