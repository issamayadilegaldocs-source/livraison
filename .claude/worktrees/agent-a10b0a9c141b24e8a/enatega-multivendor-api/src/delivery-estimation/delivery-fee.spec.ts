import {
  computeDeliveryFee,
  computeDeliveryBonus,
  haversineKm,
  normalizeFee,
} from './delivery-fee';

describe('haversineKm', () => {
  it('returns ~0 for identical points', () => {
    expect(haversineKm(34.74, 10.76, 34.74, 10.76)).toBeCloseTo(0, 5);
  });

  it('computes a known Sfax-area distance (~1.5 km)', () => {
    // Two points ~1.5 km apart in Sfax.
    const d = haversineKm(34.7406, 10.7603, 34.7541, 10.7603);
    expect(d).toBeGreaterThan(1.4);
    expect(d).toBeLessThan(1.6);
  });

  it('returns 0 for any non-finite coordinate (malformed address)', () => {
    expect(haversineKm(NaN, 10, 34, 10)).toBe(0);
    expect(haversineKm(34, 10, Infinity, 10)).toBe(0);
    // @ts-expect-error deliberately passing a bad type
    expect(haversineKm(undefined, 10, 34, 10)).toBe(0);
  });
});

describe('computeDeliveryFee', () => {
  it('fixed: charges a flat rate regardless of distance', () => {
    expect(computeDeliveryFee({ costType: 'fixed', deliveryRate: 3 }, 0)).toBe(3);
    expect(computeDeliveryFee({ costType: 'fixed', deliveryRate: 3 }, 42)).toBe(3);
  });

  it('perKM (default): ceil(distance) × rate', () => {
    expect(computeDeliveryFee({ costType: 'perKM', deliveryRate: 1.5 }, 2.1)).toBe(4.5); // ceil(2.1)=3 × 1.5
    expect(computeDeliveryFee({ deliveryRate: 2 }, 0.2)).toBe(2); // default model, ceil(0.2)=1 × 2
  });

  it('tiered: base fee + billable km beyond the free distance', () => {
    // baseFee 0.5 + max(0, ceil(4.2)-2)=3 × 1.25 = 0.5 + 3.75 = 4.25
    expect(
      computeDeliveryFee(
        { costType: 'tiered', deliveryRate: 1.25, baseDeliveryFee: 0.5, baseDeliveryDistance: 2 },
        4.2,
      ),
    ).toBe(4.25);
  });

  it('tiered: within the free distance charges only the base fee', () => {
    expect(
      computeDeliveryFee(
        { costType: 'tiered', deliveryRate: 1.25, baseDeliveryFee: 0.5, baseDeliveryDistance: 5 },
        3,
      ),
    ).toBe(0.5);
  });

  it('never returns a negative fee even with hostile inputs', () => {
    expect(computeDeliveryFee({ costType: 'perKM', deliveryRate: -5 }, 10)).toBe(0);
    expect(computeDeliveryFee({ costType: 'perKM', deliveryRate: 2 }, -10)).toBe(0);
    expect(computeDeliveryFee(null, 10)).toBe(0);
    expect(computeDeliveryFee(undefined, 10)).toBe(0);
  });

  it('linear: base + rate × continuous distance (no ceil)', () => {
    // 1.75 + 0.326 × 3.8 = 2.9888
    expect(
      computeDeliveryFee(
        { costType: 'linear', deliveryRate: 0.326, baseDeliveryFee: 1.75 },
        3.8,
      ),
    ).toBeCloseTo(2.9888, 4);
  });

  it('reproduces the reconstructed TND tariff with round-to-0.5 + [2,6] caps', () => {
    const config = {
      costType: 'linear',
      deliveryRate: 0.326,
      baseDeliveryFee: 1.75,
      deliveryRoundToNearest: 0.5,
      deliveryFeeMinimum: 2,
      deliveryFeeMaximum: 6,
    };
    // 3.8 km → 2.979 → round 0.5 → 3.0
    expect(computeDeliveryFee(config, 3.8)).toBe(3);
    // 8.6 km → 1.75 + 0.326×8.6 = 4.5436 → round 0.5 → 4.5
    expect(computeDeliveryFee(config, 8.6)).toBe(4.5);
    // 13 km → 1.75 + 0.326×13 = 5.988 → round 0.5 → 6.0 (also the cap)
    expect(computeDeliveryFee(config, 13)).toBe(6);
    // Very short → raw ~1.75 → round 0.5 → 1.5, floored up to the 2.0 minimum
    expect(computeDeliveryFee(config, 0.2)).toBe(2);
    // Very long → raw well above 6 → capped at the 6.0 maximum
    expect(computeDeliveryFee(config, 40)).toBe(6);
  });
});

describe('computeDeliveryBonus', () => {
  const cfg = {
    deliveryBonusEnabled: true,
    deliveryBonusPerKm: 0.5,
    deliveryBonusFreeDistance: 6,
    deliveryBonusMax: 3.5,
  };

  it('is 0 when disabled or the per-km rate is 0', () => {
    expect(computeDeliveryBonus({ ...cfg, deliveryBonusEnabled: false }, 20)).toBe(0);
    expect(computeDeliveryBonus({ ...cfg, deliveryBonusPerKm: 0 }, 20)).toBe(0);
    expect(computeDeliveryBonus(null, 20)).toBe(0);
  });

  it('accrues only beyond the free distance', () => {
    expect(computeDeliveryBonus(cfg, 6)).toBe(0); // at the free threshold
    expect(computeDeliveryBonus(cfg, 4)).toBe(0); // below it
    // 8 km → (8-6)×0.5 = 1.0
    expect(computeDeliveryBonus(cfg, 8)).toBeCloseTo(1, 9);
  });

  it('caps the bonus at the configured max (0 = uncapped)', () => {
    // 20 km → (20-6)×0.5 = 7 → capped at 3.5
    expect(computeDeliveryBonus(cfg, 20)).toBe(3.5);
    expect(computeDeliveryBonus({ ...cfg, deliveryBonusMax: 0 }, 20)).toBeCloseTo(7, 9);
  });
});

describe('normalizeFee', () => {
  it('rounds to the nearest step before clamping', () => {
    expect(normalizeFee(2.979, { deliveryRoundToNearest: 0.5 })).toBe(3);
    expect(normalizeFee(4.2, { deliveryRoundToNearest: 0.5 })).toBe(4);
  });

  it('applies the floor and the cap (0 = disabled)', () => {
    expect(normalizeFee(1, { deliveryFeeMinimum: 2 })).toBe(2);
    expect(normalizeFee(9, { deliveryFeeMaximum: 6 })).toBe(6);
    expect(normalizeFee(9, { deliveryFeeMaximum: 0 })).toBe(9); // 0 = no cap
    expect(normalizeFee(1, { deliveryFeeMinimum: 0 })).toBe(1); // 0 = no floor
  });

  it('is a no-op when no shaping is configured', () => {
    expect(normalizeFee(3.33, {})).toBe(3.33);
    expect(normalizeFee(3.33, null)).toBe(3.33);
  });
});
