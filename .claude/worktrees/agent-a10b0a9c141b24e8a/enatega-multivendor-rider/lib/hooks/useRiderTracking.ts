import { useEffect, useRef, useState } from "react";
import { LatLng } from "react-native-maps";
import { useLocationContext } from "@/lib/context/global/location.context";

const MAX_BREADCRUMB_POINTS = 100;
const MIN_DISTANCE_METERS = 10;

function haversineDistance(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const c =
    sinDLat * sinDLat +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      sinDLon *
      sinDLon;
  return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
}

function isValidCoord(lat: number, lon: number): boolean {
  return (
    !isNaN(lat) &&
    !isNaN(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180 &&
    !(lat === 0 && lon === 0)
  );
}

export const useRiderTracking = (isActiveDelivery: boolean) => {
  const { location } = useLocationContext();
  const [breadcrumbTrail, setBreadcrumbTrail] = useState<LatLng[]>([]);

  const lastBreadcrumbPoint = useRef<LatLng | null>(null);

  useEffect(() => {
    if (!isActiveDelivery) return;

    const lat = parseFloat(location?.latitude as string);
    const lon = parseFloat(location?.longitude as string);
    if (!isValidCoord(lat, lon)) return;

    const current: LatLng = { latitude: lat, longitude: lon };

    // Add to breadcrumb trail when rider has moved enough
    const prev = lastBreadcrumbPoint.current;
    if (!prev || haversineDistance(prev, current) >= MIN_DISTANCE_METERS) {
      lastBreadcrumbPoint.current = current;
      setBreadcrumbTrail((trail) => {
        const next = [...trail, current];
        return next.length > MAX_BREADCRUMB_POINTS
          ? next.slice(next.length - MAX_BREADCRUMB_POINTS)
          : next;
      });
    }

  }, [location?.latitude, location?.longitude, isActiveDelivery]);

  const resetTrail = () => {
    setBreadcrumbTrail([]);
    lastBreadcrumbPoint.current = null;
  };

  return { breadcrumbTrail, resetTrail };
};
