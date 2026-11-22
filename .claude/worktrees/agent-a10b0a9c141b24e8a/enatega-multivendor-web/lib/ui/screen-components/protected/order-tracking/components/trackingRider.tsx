import React, { useEffect, useMemo } from "react";
import { useQuery } from "@apollo/client";
import { Marker } from "@react-google-maps/api";
import { ORDER_RIDER_LOCATION_UPDATED } from "@/lib/api/graphql/subscription/riderLocation";
import { ORDER_RIDER_LOCATION } from "@/lib/api/graphql/queries/rider";
import RiderMarker from "../../../../../assets/rider_icon.png";

interface TrackingRiderProps {
  orderId: string;
  onLocationUpdate?: (location: { lat: number; lng: number }) => void;
}

interface RiderLocation {
  orderId: string;
  latitude: number;
  longitude: number;
  receivedAt: string;
  updateId: string;
}

interface QueryData {
  orderRiderLocation: RiderLocation | null;
}

interface SubscriptionData {
  orderRiderLocationUpdated: RiderLocation;
}

const TrackingRider = ({ orderId, onLocationUpdate }: TrackingRiderProps) => {
  const { loading, error, data, subscribeToMore } = useQuery<QueryData>(ORDER_RIDER_LOCATION, {
    variables: { orderId },
    fetchPolicy: "network-only",
  });

  useEffect(() => {
    const unsubscribe = subscribeToMore<SubscriptionData>({
      document: ORDER_RIDER_LOCATION_UPDATED,
      variables: { orderId },
      updateQuery: (prev, { subscriptionData }) => {
        const incoming = subscriptionData.data?.orderRiderLocationUpdated;
        if (!incoming) return prev;
        if (
          prev.orderRiderLocation &&
          Date.parse(prev.orderRiderLocation.receivedAt) >= Date.parse(incoming.receivedAt)
        ) return prev;
        return {
          orderRiderLocation: incoming,
        };
      },
    });
    return unsubscribe;
  }, [orderId, subscribeToMore]);

  // Calculate rider coordinates (memoized to prevent unnecessary recalculations)
  const riderCoordinates = useMemo(() => {
    const location = data?.orderRiderLocation;
    if (!location) {
      return null;
    }

    const lat = Number(location.latitude);
    const lng = Number(location.longitude);

    if (isNaN(lat) || isNaN(lng)) {
      return null;
    }

    return { lat, lng };
  }, [data?.orderRiderLocation]);

  // Notify parent of location updates - this hook must be called before any conditional returns
  useEffect(() => {
    if (onLocationUpdate && riderCoordinates) {
      onLocationUpdate(riderCoordinates);
    }
  }, [riderCoordinates, onLocationUpdate]);

  // Early returns after all hooks
  if (loading) return null;
  if (error) {
    console.error("Error fetching rider data:", error);
    return null;
  }

  if (!riderCoordinates) {
    return null;
  }

  return (
    <Marker
      position={riderCoordinates}
      icon={{
        url: RiderMarker.src,
        scaledSize: new window.google.maps.Size(40, 40),
      }}
    />
  );
};

export default TrackingRider;
