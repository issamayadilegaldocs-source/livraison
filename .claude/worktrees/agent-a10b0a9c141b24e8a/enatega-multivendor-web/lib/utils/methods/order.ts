// Converts numeric degrees to radians
function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

// Calculates the distance between two coordinates in kilometers
export function calculateDistance(
  latS: number,
  lonS: number,
  latD: number,
  lonD: number
): number {
  const R = 6371; // Radius of the Earth in km
  const dLat = toRad(latD - latS);
  const dLon = toRad(lonD - lonS);
  const lat1 = toRad(latS);
  const lat2 = toRad(latD);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

// Customer service fee: percentage of the discounted food amount, clamped to a
// floor and (optional) cap. Mirrors the API's computeServiceFeeMoney. rate is a
// fraction (0.07 = 7%); cap 0 = uncapped. Disabled or zero rate → 0.
export interface ServiceFeeConfig {
  serviceFeeEnabled?: boolean;
  serviceFeeRate?: number;
  serviceFeeMinimum?: number;
  serviceFeeMaximum?: number;
}

export function calculateServiceFee(
  {
    serviceFeeEnabled,
    serviceFeeRate,
    serviceFeeMinimum,
    serviceFeeMaximum,
  }: ServiceFeeConfig,
  foodAmount: number
): number {
  const rate = Number(serviceFeeRate);
  if (!serviceFeeEnabled || !Number.isFinite(rate) || rate <= 0) return 0;
  const base = Number.isFinite(foodAmount) && foodAmount > 0 ? foodAmount : 0;
  let fee = Math.max(base * rate, Number(serviceFeeMinimum) || 0);
  const cap = Number(serviceFeeMaximum);
  if (Number.isFinite(cap) && cap > 0) fee = Math.min(fee, cap);
  return fee;
}

// Shaping options for the delivery fee — mirrors the API's
// delivery-fee.ts#normalizeFee (round-to-nearest, then floor/cap).
export interface DeliveryFeeShaping {
  min?: number;
  max?: number;
  round?: number;
}

export function normalizeDeliveryFee(
  raw: number,
  { min = 0, max = 0, round = 0 }: DeliveryFeeShaping = {}
): number {
  let fee = Number.isFinite(raw) && raw > 0 ? raw : 0;
  if (round > 0) fee = Math.round(fee / round) * round;
  if (min > 0) fee = Math.max(fee, min);
  if (max > 0) fee = Math.min(fee, max);
  return fee;
}

// Calculates the delivery amount based on cost type and distance. Must stay
// identical to the customer app's calculateAmount and the API's
// computeDeliveryFee — the server recomputes and would otherwise charge a
// different amount than the customer was quoted.
export function calculateAmount(
  costType: "fixed" | "perKM" | "per_km" | "tiered" | "linear",
  deliveryRate: number,
  distance: number,
  baseFee = 0,
  baseDistance = 0,
  shaping: DeliveryFeeShaping = {}
): number {
  let raw: number;
  if (costType === "fixed") {
    raw = deliveryRate;
  } else if (costType === "tiered") {
    raw = baseFee + Math.max(0, Math.ceil(distance) - baseDistance) * deliveryRate;
  } else if (costType === "linear") {
    raw = baseFee + deliveryRate * distance;
  } else {
    raw = Math.ceil(distance) * deliveryRate;
  }
  return normalizeDeliveryFee(raw, shaping);
}
