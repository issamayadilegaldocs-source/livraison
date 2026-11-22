import { Money } from '../common/money/money';

/**
 * Settlement split for one delivered COD order.
 *
 * In cash-on-delivery the rider physically collects `orderAmount`. That single
 * pot must be divided among the three parties so that the parts sum back to the
 * cash collected — no money invented, none lost. The agreed policy:
 *
 *   - Marketplace commission is charged on the FOOD only, and specifically on
 *     the ORIGINAL pre-discount subtotal (`subtotal`), never on delivery, tip,
 *     tax, the express surcharge or the customer service fee. The restaurant is
 *     paid `subtotal × (1 − rate)` regardless of any promo discount, so the
 *     PLATFORM (not the restaurant) funds discounts.
 *   - The rider earns their delivery commission (`riderEarnings`, already frozen
 *     on the order) PLUS 100% of the tip PLUS the platform-funded delivery bonus.
 *     The remainder of the delivery fee goes to the platform.
 *   - Tax, the express surcharge and the customer service fee pass through to
 *     the platform.
 *   - The delivery bonus is funded by the platform: it is added to the rider's
 *     total and drawn from the platform's share, so the reconcile identity is
 *     preserved — platformTotal + storeEarnings + riderTotal === orderAmount —
 *     with platformTotal reduced (possibly below zero) by the bonus it funds.
 *
 * All parts are quantized to the currency scale (millimes for TND). The rider
 * and store shares are computed independently; the platform is the residual, so
 * that platformTotal + storeEarnings + riderTotal === orderAmount EXACTLY in
 * minor units. Because the store is paid on the FULL subtotal while the customer
 * only paid the discounted food, the platform total can legitimately go NEGATIVE
 * by (up to) the discount amount — that is the platform funding the promo, not a
 * bug. Do not clamp platformTotal to ≥ 0.
 *
 * Backward compatibility: `subtotal` is optional. When it is absent/0 (orders
 * placed before this field existed), the split falls back to the discounted
 * `netFood` base so historical earnings keep reconciling.
 */
export interface EarningsSplitInput {
  orderAmount: number;
  /** Original pre-discount menu subtotal; commission base. Falls back to netFood when absent. */
  subtotal?: number;
  deliveryCharges: number;
  tipping: number;
  taxationAmount: number;
  expressSurcharge: number;
  /** Customer service/platform fee; passes through to the platform. */
  serviceFee?: number;
  /** Rider's delivery commission, frozen on the order at delivery. */
  riderEarnings: number;
  /** Platform-funded rider bonus; added to rider pay, drawn from the platform. */
  deliveryBonus?: number;
  /** Marketplace commission rate, 0..1. */
  commissionRate: number;
  /** Currency minor-unit scale (e.g. 3 for TND millimes). Defaults to 3. */
  scale?: number;
}

export interface EarningsSplit {
  netFood: number;
  marketplaceCommission: number;
  storeEarnings: number;
  platformDeliveryShare: number;
  riderDelivery: number;
  tip: number;
  /** Platform-funded bonus paid to the rider on top of commission + tip. */
  deliveryBonus: number;
  riderTotal: number;
  platformTotal: number;
}

const nonNeg = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export function computeEarningsSplit(input: EarningsSplitInput): EarningsSplit {
  const scale = Number.isInteger(input.scale) ? (input.scale as number) : 3;
  const cfg = { currency: 'TND', scale };
  const factor = 10 ** scale;
  const toMinor = (v: number): number => Money.fromDecimal(String(v), cfg).toSafeMinorNumber();

  const orderMinor = toMinor(nonNeg(input.orderAmount));
  const subtotalMinor = toMinor(nonNeg(input.subtotal));
  const deliveryMinor = toMinor(nonNeg(input.deliveryCharges));
  const tipMinor = toMinor(nonNeg(input.tipping));
  const taxMinor = toMinor(nonNeg(input.taxationAmount));
  const expressMinor = toMinor(nonNeg(input.expressSurcharge));
  const serviceFeeMinor = toMinor(nonNeg(input.serviceFee));
  const bonusMinor = toMinor(nonNeg(input.deliveryBonus));
  const rate = Math.max(0, Math.min(1, Number(input.commissionRate) || 0));

  // The rider's delivery commission can never exceed the delivery fee actually
  // collected (a stale/misconfigured value must not overdraw the pot).
  const riderDeliveryMinor = Math.min(toMinor(nonNeg(input.riderEarnings)), deliveryMinor);

  // Discounted food actually paid by the customer — reported as `netFood` and
  // used as the commission-base fallback for legacy orders without a subtotal.
  const netFoodMinor = Math.max(
    0,
    orderMinor - deliveryMinor - tipMinor - taxMinor - expressMinor - serviceFeeMinor,
  );

  // Commission is charged on the ORIGINAL subtotal (platform funds discounts).
  // Legacy orders (no persisted subtotal) fall back to the discounted netFood so
  // their historical earnings keep reconciling.
  const commissionBaseMinor = subtotalMinor > 0 ? subtotalMinor : netFoodMinor;
  const storeMinor = Math.round(commissionBaseMinor * (1 - rate));
  const marketplaceCommissionMinor = commissionBaseMinor - storeMinor;

  const platformDeliveryMinor = Math.max(0, deliveryMinor - riderDeliveryMinor);
  // Rider earns delivery commission + tip + the platform-funded bonus.
  const riderTotalMinor = riderDeliveryMinor + tipMinor + bonusMinor;

  // Platform is the residual so the three parts reconcile to the cash pot to the
  // millime. This CAN be negative when the store is paid on the full subtotal
  // (platform funds the discount) and/or when the platform funds the rider bonus.
  const platformTotalMinor = orderMinor - storeMinor - riderTotalMinor;

  return {
    netFood: netFoodMinor / factor,
    marketplaceCommission: marketplaceCommissionMinor / factor,
    storeEarnings: storeMinor / factor,
    platformDeliveryShare: platformDeliveryMinor / factor,
    riderDelivery: riderDeliveryMinor / factor,
    tip: tipMinor / factor,
    deliveryBonus: bonusMinor / factor,
    riderTotal: riderTotalMinor / factor,
    platformTotal: platformTotalMinor / factor,
  };
}
