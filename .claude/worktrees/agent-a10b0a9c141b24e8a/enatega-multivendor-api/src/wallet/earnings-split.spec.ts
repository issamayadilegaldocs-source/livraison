import { computeEarningsSplit, EarningsSplitInput } from './earnings-split';

// A representative delivered order: food 20, delivery 3 (rider commission 1),
// tip 2, tax 1, express 0.5 → orderAmount 26.5. Commission rate 10%.
const order: EarningsSplitInput = {
  orderAmount: 26.5,
  deliveryCharges: 3,
  tipping: 2,
  taxationAmount: 1,
  expressSurcharge: 0.5,
  riderEarnings: 1,
  commissionRate: 0.1,
};

describe('computeEarningsSplit (SET)', () => {
  it('SET-05: the parts sum back to the cash collected', () => {
    const s = computeEarningsSplit(order);
    expect(s.platformTotal + s.storeEarnings + s.riderTotal).toBeCloseTo(order.orderAmount, 9);
  });

  it('SET-03: marketplace commission is charged on food only', () => {
    const s = computeEarningsSplit(order);
    // netFood = 26.5 - 3 - 2 - 1 - 0.5 = 20 → commission 10% = 2.0
    expect(s.netFood).toBeCloseTo(20, 9);
    expect(s.marketplaceCommission).toBeCloseTo(2, 9);
    expect(s.storeEarnings).toBeCloseTo(18, 9);
  });

  it('SET-04: the rider gets the full tip plus the delivery commission', () => {
    const s = computeEarningsSplit(order);
    expect(s.tip).toBeCloseTo(2, 9);
    expect(s.riderDelivery).toBeCloseTo(1, 9);
    expect(s.riderTotal).toBeCloseTo(3, 9);
  });

  it('the store is never credited any delivery, tip, tax or express', () => {
    // Same order but with zero food → store gets nothing, everything else routes
    // to platform/rider and still balances.
    const s = computeEarningsSplit({ ...order, orderAmount: 6.5 }); // 0 food + 3 + 2 + 1 + 0.5
    expect(s.netFood).toBeCloseTo(0, 9);
    expect(s.storeEarnings).toBeCloseTo(0, 9);
    expect(s.platformTotal + s.riderTotal).toBeCloseTo(6.5, 9);
  });

  it('platform keeps the delivery remainder, tax and express', () => {
    const s = computeEarningsSplit(order);
    // delivery share = 3 - 1 = 2 ; + tax 1 + express 0.5 + commission 2 = 5.5
    expect(s.platformDeliveryShare).toBeCloseTo(2, 9);
    expect(s.platformTotal).toBeCloseTo(5.5, 9);
  });

  it('clamps a rider commission that exceeds the delivery fee (no overdraw)', () => {
    const s = computeEarningsSplit({ ...order, riderEarnings: 999 });
    expect(s.riderDelivery).toBeCloseTo(3, 9); // capped at the delivery fee
    expect(s.platformDeliveryShare).toBe(0);
    expect(s.platformTotal + s.storeEarnings + s.riderTotal).toBeCloseTo(order.orderAmount, 9);
  });

  it('routes the customer service fee to the platform, never to the store', () => {
    // Same order but with a 1.4 service fee added on top (orderAmount 27.9).
    const withFee = computeEarningsSplit({
      ...order,
      orderAmount: 27.9,
      serviceFee: 1.4,
    });
    // netFood excludes the service fee: 27.9 - 3 - 2 - 1 - 0.5 - 1.4 = 20 → commission unchanged.
    expect(withFee.netFood).toBeCloseTo(20, 9);
    expect(withFee.marketplaceCommission).toBeCloseTo(2, 9);
    expect(withFee.storeEarnings).toBeCloseTo(18, 9);
    // The 1.4 fee lands in the platform total (previous platformTotal 5.5 + 1.4 = 6.9).
    expect(withFee.platformTotal).toBeCloseTo(6.9, 9);
    expect(
      withFee.platformTotal + withFee.storeEarnings + withFee.riderTotal,
    ).toBeCloseTo(27.9, 9);
  });

  it('charges commission on the ORIGINAL subtotal, so the platform funds the discount', () => {
    // Reconstructed order 570464: subtotal 27, 10% promo → discounted food 24.3,
    // service fee 1.701, delivery 3 → orderAmount 29.001. Restaurant rate 15%.
    const s = computeEarningsSplit({
      orderAmount: 29.001,
      subtotal: 27,
      deliveryCharges: 3,
      tipping: 0,
      taxationAmount: 0,
      expressSurcharge: 0,
      serviceFee: 1.701,
      riderEarnings: 2.4, // 3 × 0.8
      commissionRate: 0.15,
      scale: 3,
    });
    // Store is paid on the FULL subtotal: 27 × 0.85 = 22.95 (not on the discounted food).
    expect(s.storeEarnings).toBeCloseTo(22.95, 3);
    expect(s.marketplaceCommission).toBeCloseTo(4.05, 3);
    // Reconcile identity still holds exactly.
    expect(s.platformTotal + s.storeEarnings + s.riderTotal).toBeCloseTo(29.001, 3);
  });

  it('lets the platform total go negative when the discount exceeds the platform margin', () => {
    // Huge discount: subtotal 100 but customer paid only 10 for food (90 off).
    const s = computeEarningsSplit({
      orderAmount: 10,
      subtotal: 100,
      deliveryCharges: 0,
      tipping: 0,
      taxationAmount: 0,
      expressSurcharge: 0,
      serviceFee: 0,
      riderEarnings: 0,
      commissionRate: 0.1,
      scale: 3,
    });
    expect(s.storeEarnings).toBeCloseTo(90, 3); // 100 × 0.9 — restaurant paid on full subtotal
    // Platform funded the discount → negative total, and the parts still reconcile to the pot.
    expect(s.platformTotal).toBeLessThan(0);
    expect(s.platformTotal + s.storeEarnings + s.riderTotal).toBeCloseTo(10, 3);
  });

  it('adds the platform-funded delivery bonus to rider pay, drawn from the platform', () => {
    const withBonus = computeEarningsSplit({ ...order, deliveryBonus: 1.5 });
    const baseline = computeEarningsSplit(order);
    // Rider gets an extra 1.5 on top of commission + tip.
    expect(withBonus.deliveryBonus).toBeCloseTo(1.5, 9);
    expect(withBonus.riderTotal).toBeCloseTo(baseline.riderTotal + 1.5, 9);
    // The platform funds it — its total drops by exactly the bonus.
    expect(withBonus.platformTotal).toBeCloseTo(baseline.platformTotal - 1.5, 9);
    // Store is unaffected; reconcile identity still holds against the same pot.
    expect(withBonus.storeEarnings).toBeCloseTo(baseline.storeEarnings, 9);
    expect(
      withBonus.platformTotal + withBonus.storeEarnings + withBonus.riderTotal,
    ).toBeCloseTo(order.orderAmount, 9);
  });

  it('still balances for a pickup order (no delivery, no rider)', () => {
    const pickup: EarningsSplitInput = {
      orderAmount: 20,
      deliveryCharges: 0,
      tipping: 0,
      taxationAmount: 0,
      expressSurcharge: 0,
      riderEarnings: 0,
      commissionRate: 0.1,
    };
    const s = computeEarningsSplit(pickup);
    expect(s.marketplaceCommission).toBeCloseTo(2, 9);
    expect(s.storeEarnings).toBeCloseTo(18, 9);
    expect(s.platformTotal + s.storeEarnings + s.riderTotal).toBeCloseTo(20, 9);
  });
});
