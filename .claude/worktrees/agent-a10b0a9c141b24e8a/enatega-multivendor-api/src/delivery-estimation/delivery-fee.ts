/**
 * Server-authoritative delivery-fee calculation.
 *
 * The customer app computes the delivery fee client-side (see the mobile app's
 * `calculateAmount` / `calculateDistance` helpers) and sends it to `placeOrder`.
 * That value must never be trusted: a client can post `deliveryCharges: 0` to
 * ride for free (starving the rider commission, which is derived from it) or a
 * negative value to shrink the order total. The API therefore recomputes the fee
 * from the same inputs the client uses — the configured pricing model plus the
 * straight-line distance between the restaurant and the delivery address — so the
 * money math is anchored to server state, not to the request payload.
 *
 * The formula intentionally mirrors the mobile client so a legitimate order is
 * charged the same fee the customer was quoted.
 */

/** Pricing knobs read from the singleton `Configuration` document. */
export interface DeliveryFeeConfig {
  costType?: string;
  deliveryRate?: number;
  baseDeliveryFee?: number;
  baseDeliveryDistance?: number;
  /** Optional floor applied to the computed fee (0 = no floor). */
  deliveryFeeMinimum?: number;
  /** Optional cap applied to the computed fee (0 = no cap). */
  deliveryFeeMaximum?: number;
  /** Round the raw fee to the nearest multiple of this (0 = no rounding). */
  deliveryRoundToNearest?: number;
}

// Re-exported for existing call sites (this module, and orders.service.ts's
// arrival-proximity/distance-fallback math) — the actual implementation lives
// in the shared geo util so tracking, dispatch and delivery-fee never drift.
export { haversineKm } from '../common/geo/haversine';

const toNonNegativeNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * Apply rounding then floor/cap to a raw fee. Kept separate from the per-costType
 * math so every code path that produces a fee — including the coordinate-missing
 * fallback in orders.service — normalizes identically (rounding/caps can never be
 * bypassed by address quality). Order matters: round first, then clamp, so the
 * cap is a hard ceiling on the displayed tariff.
 */
export function normalizeFee(raw: number, config: DeliveryFeeConfig | null | undefined): number {
  let fee = toNonNegativeNumber(raw);

  const step = toNonNegativeNumber(config?.deliveryRoundToNearest);
  if (step > 0) fee = Math.round(fee / step) * step;

  const min = toNonNegativeNumber(config?.deliveryFeeMinimum);
  if (min > 0) fee = Math.max(fee, min);

  const max = toNonNegativeNumber(config?.deliveryFeeMaximum);
  if (max > 0) fee = Math.min(fee, max);

  return fee;
}

/**
 * Delivery fee for a given distance under the configured pricing model. Mirrors
 * the customer app's `calculateAmount`:
 *   - `fixed`  → flat `deliveryRate`
 *   - `tiered` → `baseDeliveryFee` + billable km beyond `baseDeliveryDistance` × `deliveryRate`
 *   - `linear` → `baseDeliveryFee` + `deliveryRate` × `distanceKm` (continuous, no `ceil`)
 *   - `perKM`  (default) → `ceil(distanceKm)` × `deliveryRate`
 *
 * The raw per-model value is then passed through `normalizeFee` (round-to-nearest,
 * then floor/cap). All inputs are coerced to non-negative numbers, so the result
 * is always ≥ 0 — a client can never drive it below zero.
 */
export function computeDeliveryFee(
  config: DeliveryFeeConfig | null | undefined,
  distanceKm: number,
): number {
  const rate = toNonNegativeNumber(config?.deliveryRate);
  const costType = config?.costType ?? 'perKM';
  const distance = toNonNegativeNumber(distanceKm);
  const baseFee = toNonNegativeNumber(config?.baseDeliveryFee);

  let raw: number;
  if (costType === 'fixed') {
    raw = rate;
  } else if (costType === 'tiered') {
    const baseDistance = toNonNegativeNumber(config?.baseDeliveryDistance);
    raw = baseFee + Math.max(0, Math.ceil(distance) - baseDistance) * rate;
  } else if (costType === 'linear') {
    raw = baseFee + rate * distance;
  } else {
    raw = Math.ceil(distance) * rate;
  }

  return normalizeFee(raw, config);
}

/** Pricing knobs for the platform-funded rider delivery bonus. */
export interface DeliveryBonusConfig {
  deliveryBonusEnabled?: boolean;
  deliveryBonusPerKm?: number;
  /** Distance (km) that accrues no bonus; the bonus applies only beyond it. */
  deliveryBonusFreeDistance?: number;
  /** Cap on the bonus (0 = uncapped). */
  deliveryBonusMax?: number;
}

/**
 * Platform-funded rider delivery bonus for a given distance. Compensates riders
 * for longer deliveries beyond the customer-facing fee cap. It is NOT charged to
 * the customer (never part of the order total); it is paid by the platform and
 * added to the rider's earnings at settlement. Disabled or a zero per-km rate
 * yields 0. This value is a default the admin may override per order.
 */
export function computeDeliveryBonus(
  config: DeliveryBonusConfig | null | undefined,
  distanceKm: number,
): number {
  if (!config?.deliveryBonusEnabled) return 0;
  const perKm = toNonNegativeNumber(config?.deliveryBonusPerKm);
  if (perKm <= 0) return 0;

  const freeDistance = toNonNegativeNumber(config?.deliveryBonusFreeDistance);
  const distance = toNonNegativeNumber(distanceKm);
  let bonus = Math.max(0, distance - freeDistance) * perKm;

  const max = toNonNegativeNumber(config?.deliveryBonusMax);
  if (max > 0) bonus = Math.min(bonus, max);
  return bonus;
}
