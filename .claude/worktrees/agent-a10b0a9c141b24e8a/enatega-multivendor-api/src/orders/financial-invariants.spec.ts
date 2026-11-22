import { Types } from 'mongoose';
import { OrdersService } from './orders.service';
import { Money } from '../common/money/money';
import { computeEarningsSplit } from '../wallet/earnings-split';

/**
 * End-to-end financial invariant campaign.
 *
 * Drives the REAL placeOrder over a large matrix of item/variant/extra/quantity/
 * discount/coupon/tax/tip/delivery combinations plus a seeded fuzz loop, and
 * asserts the money-conservation properties that must hold for a production COD
 * platform — regardless of the exact pricing formula:
 *
 *   I1  no negative amount is ever persisted
 *   I2  every *Minor field is a safe integer (no fractional millimes)
 *   I3  the persisted decimal equals its minor field ÷ 10^scale (no drift)
 *   I4  discount never exceeds the item subtotal (no over-discount)
 *   I5  CONSERVATION: orderAmount = max(0, subtotal − discount − loyalty)
 *                     + delivery + tip + tax + express + serviceFee, to the millime
 *   I6  BALANCE: the settlement split (restaurant + rider + platform) sums back
 *                to the cash collected, exactly, in minor units. A rider bonus
 *                reduces the platform's net share; it is never customer-charged.
 */

type Item = { price: number; qty: number; optionPrices?: number[] };
interface Scenario {
  items: Item[];
  scale?: number;
  taxRate?: number; // restaurant.tax %
  minimumOrder?: number;
  offerDiscount?: number; // absolute, from offersService.computeDiscount
  loyaltyDiscount?: number; // absolute, from loyaltyService.redeemPoints
  loyaltyPoints?: number;
  couponDiscount?: number; // absolute flat coupon
  couponUsageLimit?: number;
  couponClaim?: boolean; // claimUse result
  tip?: number;
  express?: boolean;
  expressSurcharge?: number;
  delivery?: {
    costType: string;
    deliveryRate: number;
    baseDeliveryFee?: number;
    baseDeliveryDistance?: number;
    deliveryFeeMinimum?: number;
    deliveryFeeMaximum?: number;
    deliveryRoundToNearest?: number;
  };
  serviceFee?: { enabled: boolean; rate: number; minimum?: number; maximum?: number };
  deliveryBonus?: { enabled: boolean; perKm: number; freeDistance?: number; maximum?: number };
  isPickedUp?: boolean;
  restaurantLocation?: [number, number];
  addressLatLon?: [number, number];
}

const RIDER_RATE = 0.75; // rider keeps 75% of the delivery fee as commission
const COMMISSION_RATE = 0.15; // platform marketplace rate on food

// Runs the real placeOrder for a scenario and returns the persisted order payload.
async function place(scenario: Scenario): Promise<any> {
  const scale = scenario.scale ?? 3;
  const restaurantId = new Types.ObjectId();
  const userMongoId = new Types.ObjectId();
  const addonId = new Types.ObjectId();

  const foods: any[] = [];
  const options: any[] = [];
  const orderInput: any[] = [];
  scenario.items.forEach((item) => {
    const foodId = new Types.ObjectId();
    const variationId = new Types.ObjectId();
    foods.push({ _id: foodId, title: 'F', variations: [{ _id: variationId, title: 'V', price: item.price }] });
    const optIds = (item.optionPrices ?? []).map((price) => {
      const _id = new Types.ObjectId();
      options.push({ _id, title: 'O', price });
      return _id;
    });
    orderInput.push({
      food: String(foodId),
      variation: String(variationId),
      quantity: item.qty,
      addons: optIds.length ? [{ _id: String(addonId), options: optIds.map(String) }] : [],
    });
  });

  const catalog = { foods, addons: [{ _id: addonId, title: 'A' }], options };

  const configurationModel = {
    findOne: jest.fn().mockReturnValue({
      lean: () => ({
        exec: () =>
          Promise.resolve({
            currency: 'TND',
            currencyDecimalDigits: scale,
            loyaltyEnabled: true,
            loyaltyPointsRedemptionRate: 100,
            expressEnabled: true,
            expressSurcharge: scenario.expressSurcharge ?? 2,
            costType: scenario.delivery?.costType ?? 'fixed',
            deliveryRate: scenario.delivery?.deliveryRate ?? 0,
            baseDeliveryFee: scenario.delivery?.baseDeliveryFee ?? 0,
            baseDeliveryDistance: scenario.delivery?.baseDeliveryDistance ?? 0,
            deliveryFeeMinimum: scenario.delivery?.deliveryFeeMinimum ?? 0,
            deliveryFeeMaximum: scenario.delivery?.deliveryFeeMaximum ?? 0,
            deliveryRoundToNearest: scenario.delivery?.deliveryRoundToNearest ?? 0,
            serviceFeeEnabled: scenario.serviceFee?.enabled ?? false,
            serviceFeeRate: scenario.serviceFee?.rate ?? 0,
            serviceFeeMinimum: scenario.serviceFee?.minimum ?? 0,
            serviceFeeMaximum: scenario.serviceFee?.maximum ?? 0,
            deliveryBonusEnabled: scenario.deliveryBonus?.enabled ?? false,
            deliveryBonusPerKm: scenario.deliveryBonus?.perKm ?? 0,
            deliveryBonusFreeDistance: scenario.deliveryBonus?.freeDistance ?? 0,
            deliveryBonusMax: scenario.deliveryBonus?.maximum ?? 0,
          }),
      }),
    }),
  };
  const restaurantsService = {
    findOrderPlacementProfile: jest.fn().mockResolvedValue({
      _id: restaurantId,
      isActive: true,
      isAvailable: true,
      openingTimes: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day) => ({
        day,
        times: [{ startTime: '00:00', endTime: '23:59' }],
      })),
      timezone: 'UTC',
      orderPrefix: 'ORD-',
      deliveryTime: 0,
      tax: scenario.taxRate ?? 0,
      minimumOrder: scenario.minimumOrder ?? 0,
      location: { coordinates: scenario.restaurantLocation ?? [10.76, 34.74] },
      categories: [{ foods }],
      addons: [{ _id: addonId }],
      options,
    }),
    incrementOrderCounter: jest.fn().mockResolvedValue(1),
    getPushIdentities: jest.fn().mockResolvedValue([]),
  };
  const catalogService = {
    getOrderPlacementCatalog: jest.fn().mockResolvedValue(catalog),
    getFoodIdsForCategories: jest.fn().mockResolvedValue([]),
  };
  const offer = scenario.offerDiscount && scenario.offerDiscount > 0 ? { _id: new Types.ObjectId() } : null;
  const offersService = {
    resolveActiveOffer: jest.fn().mockResolvedValue(offer),
    computeDiscount: jest.fn().mockReturnValue(scenario.offerDiscount ?? 0),
  };
  const couponsService = {
    applyCoupon: jest.fn().mockResolvedValue(
      scenario.couponDiscount
        ? {
            success: true,
            coupon: {
              _id: new Types.ObjectId(),
              discount: scenario.couponDiscount,
              usageLimit: scenario.couponUsageLimit ?? 0,
            },
          }
        : { success: false },
    ),
    claimUse: jest.fn().mockResolvedValue(scenario.couponClaim ?? true),
    releaseUse: jest.fn().mockResolvedValue(undefined),
  };
  const loyaltyService = {
    redeemPoints: jest.fn().mockResolvedValue(scenario.loyaltyDiscount ?? 0),
  };
  const deliveryEstimationService = {
    estimate: jest.fn().mockResolvedValue({ totalMinutes: 10 }),
  };
  const zonesService = { findByPoint: jest.fn().mockResolvedValue(null) };
  const pubSub = { publish: jest.fn().mockResolvedValue(undefined) };
  const orderModel = { create: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }) };

  const service = new OrdersService(
    orderModel as never, // 0 orderModel
    {} as never, // 1 reviewModel
    {} as never, // 2 riderModel
    configurationModel as never, // 3 config
    pubSub as never, // 4 pubSub
    { resolveMongoIdByClerkId: jest.fn().mockResolvedValue(userMongoId) } as never, // 5 users
    restaurantsService as never, // 6 restaurants
    {} as never, // 7 riders
    {} as never, // 8 tracking
    offersService as never, // 9 offers
    deliveryEstimationService as never, // 10 delivery estimation
    { createWebNotification: jest.fn() } as never, // 11 notifications
    {} as never, // 12 dispatch
    loyaltyService as never, // 13 loyalty
    couponsService as never, // 14 coupons
    {} as never, // 15 wallet
    { get: () => 'UTC' } as never, // 16 config service
    zonesService as never, // 17 zones
    catalogService as never, // 18 catalog
  );
  jest.spyOn(service as any, 'findOrderOrThrow').mockResolvedValue({ _id: new Types.ObjectId() });

  const lat = scenario.addressLatLon?.[0] ?? 34.75;
  const lon = scenario.addressLatLon?.[1] ?? 10.77;
  await service.placeOrder(
    'user_123',
    String(restaurantId),
    orderInput,
    'COD',
    scenario.tip ?? 0,
    0, // client taxationAmount — ignored by the server
    { deliveryAddress: '1 St', longitude: String(lon), latitude: String(lat) },
    new Date('2026-06-29T09:00:00.000Z').toISOString(),
    scenario.isPickedUp ?? false,
    0, // client deliveryCharges — ignored by the server
    undefined,
    scenario.couponDiscount ? 'CODE' : undefined,
    scenario.loyaltyPoints ?? 0,
    scenario.express ?? false,
  );

  return orderModel.create.mock.calls[0]?.[0];
}

// Subtotal in minor units, computed with the same Money primitive placeOrder
// uses per line (variation + options, then × quantity, then summed).
function subtotalMinor(scenario: Scenario): number {
  const scale = scenario.scale ?? 3;
  const cfg = { currency: 'TND', scale };
  let subtotal = Money.fromDecimal(0, cfg);
  for (const item of scenario.items) {
    let line = Money.fromDecimal(item.price, cfg);
    for (const opt of item.optionPrices ?? []) line = line.add(Money.fromDecimal(opt, cfg));
    line = line.multiply(String(item.qty));
    subtotal = subtotal.add(line);
  }
  return subtotal.toSafeMinorNumber();
}

// Asserts all six invariants on a persisted order payload.
function assertInvariants(order: any, scenario: Scenario, label: string) {
  const scale = scenario.scale ?? 3;
  const ctx = `[${label}]`;

  const minorFields = [
    'orderAmountMinor',
    'deliveryChargesMinor',
    'tippingMinor',
    'taxationAmountMinor',
    'discountAmountMinor',
    'loyaltyDiscountMinor',
    'expressSurchargeMinor',
    'serviceFeeMinor',
    'deliveryBonusMinor',
    'subtotalMinor',
  ];

  // I1 + I2: non-negative safe integers.
  for (const f of minorFields) {
    expect(`${ctx} ${f}=${order[f]}`).toBe(`${ctx} ${f}=${order[f]}`); // keep label in output on failure
    expect(Number.isSafeInteger(order[f])).toBe(true);
    expect(order[f]).toBeGreaterThanOrEqual(0);
  }
  expect(order.orderAmount).toBeGreaterThanOrEqual(0);

  // I3: decimal ↔ minor consistency.
  expect(order.orderAmount).toBeCloseTo(order.orderAmountMinor / 10 ** scale, 9);

  // I4: discount ≤ subtotal.
  const subMinor = subtotalMinor(scenario);
  expect(order.discountAmountMinor).toBeLessThanOrEqual(subMinor);

  // I5: conservation to the millime.
  const foodNet = Math.max(0, subMinor - order.discountAmountMinor - order.loyaltyDiscountMinor);
  const expectedOrderMinor =
    foodNet +
    order.deliveryChargesMinor +
    order.tippingMinor +
    order.taxationAmountMinor +
    order.expressSurchargeMinor +
    order.serviceFeeMinor;
  expect(order.orderAmountMinor).toBe(expectedOrderMinor);

  // I6: settlement balance in minor units. Rider commission = delivery × rate.
  const riderEarnings = order.deliveryCharges * RIDER_RATE;
  const split = computeEarningsSplit({
    orderAmount: order.orderAmount,
    subtotal: order.subtotal,
    deliveryCharges: order.deliveryCharges,
    tipping: order.tipping,
    taxationAmount: order.taxationAmount,
    expressSurcharge: order.expressSurcharge,
    serviceFee: order.serviceFee,
    deliveryBonus: order.deliveryBonus,
    riderEarnings,
    commissionRate: COMMISSION_RATE,
    scale,
  });
  const toMinor = (v: number) => Money.fromDecimal(v, { currency: 'TND', scale }).toSafeMinorNumber();
  const partsMinor = toMinor(split.platformTotal) + toMinor(split.storeEarnings) + toMinor(split.riderTotal);
  expect(partsMinor).toBe(order.orderAmountMinor);
}

describe('Financial invariant campaign — combination matrix', () => {
  const scenarios: Array<{ name: string; s: Scenario }> = [
    { name: 'single item, pickup, no extras', s: { items: [{ price: 10, qty: 1 }], isPickedUp: true } },
    {
      name: 'multi item + variants + extras + delivery + tax + tip',
      s: {
        items: [
          { price: 12.5, qty: 2, optionPrices: [1, 0.5] },
          { price: 7.333, qty: 3 },
          { price: 0.125, qty: 4 },
        ],
        taxRate: 10,
        tip: 2,
        delivery: { costType: 'perKM', deliveryRate: 1.5 },
        express: true,
      },
    },
    {
      name: 'offer + coupon stacked, tax, tiered delivery',
      s: {
        items: [{ price: 30, qty: 1 }],
        offerDiscount: 6,
        couponDiscount: 5,
        taxRate: 19,
        delivery: { costType: 'tiered', deliveryRate: 1.25, baseDeliveryFee: 0.5, baseDeliveryDistance: 1 },
        tip: 1.5,
      },
    },
    {
      name: 'coupon larger than subtotal (must clamp)',
      s: { items: [{ price: 8, qty: 1 }], couponDiscount: 50, taxRate: 10, delivery: { costType: 'fixed', deliveryRate: 3 } },
    },
    {
      name: 'all discounts exceed food (order floors food at 0, delivery/tax remain)',
      s: {
        items: [{ price: 10, qty: 1 }],
        offerDiscount: 6,
        couponDiscount: 5,
        loyaltyDiscount: 20,
        loyaltyPoints: 2000,
        taxRate: 10,
        delivery: { costType: 'fixed', deliveryRate: 3 },
      },
    },
    {
      name: 'huge quantity',
      s: { items: [{ price: 3.999, qty: 100000, optionPrices: [0.001] }], taxRate: 7, delivery: { costType: 'fixed', deliveryRate: 2 } },
    },
    {
      name: 'awkward decimals forcing half-even rounding',
      s: { items: [{ price: 3.335, qty: 3 }, { price: 1.005, qty: 7 }], taxRate: 13, tip: 0.335, delivery: { costType: 'perKM', deliveryRate: 0.777 } },
    },
    {
      name: 'express only, no delivery (pickup)',
      s: { items: [{ price: 15, qty: 2 }], isPickedUp: true, express: true, expressSurcharge: 2.5, taxRate: 10 },
    },
    {
      name: 'scale 2 currency',
      s: { items: [{ price: 9.99, qty: 3 }], scale: 2, taxRate: 20, tip: 1.5, delivery: { costType: 'perKM', deliveryRate: 2 } },
    },
  ];

  it.each(scenarios)('$name', async ({ name, s }) => {
    const order = await place(s);
    expect(order).toBeDefined();
    assertInvariants(order, s, name);
  });
});

describe('Financial invariant campaign — reconstructed Tunisian tariff', () => {
  it('persists the quoted customer total while funding the rider bonus and promo from platform margin', async () => {
    const scenario: Scenario = {
      items: [{ price: 4.5, qty: 6 }],
      offerDiscount: 2.7,
      delivery: {
        costType: 'linear',
        deliveryRate: 0.326,
        baseDeliveryFee: 1.75,
        deliveryRoundToNearest: 0.5,
        deliveryFeeMinimum: 2,
        deliveryFeeMaximum: 6,
      },
      serviceFee: { enabled: true, rate: 0.07, minimum: 0.7, maximum: 5 },
      deliveryBonus: { enabled: true, perKm: 0.2, freeDistance: 2, maximum: 3.5 },
      // 0.04157 degrees longitude at this latitude is approximately 3.8 km.
      addressLatLon: [34.74, 10.80157],
    };

    const order = await place(scenario);

    expect(order).toEqual(
      expect.objectContaining({
        subtotal: 27,
        subtotalMinor: 27000,
        discountAmount: 2.7,
        deliveryCharges: 3,
        deliveryChargesMinor: 3000,
        serviceFee: 1.701,
        serviceFeeMinor: 1701,
        orderAmount: 29.001,
        orderAmountMinor: 29001,
      }),
    );
    expect(order.deliveryBonus).toBeCloseTo(0.36, 2);
    expect(order.deliveryBonusMinor).toBe(360);

    const split = computeEarningsSplit({
      orderAmount: order.orderAmount,
      subtotal: order.subtotal,
      deliveryCharges: order.deliveryCharges,
      tipping: 0,
      taxationAmount: 0,
      expressSurcharge: 0,
      serviceFee: order.serviceFee,
      deliveryBonus: order.deliveryBonus,
      riderEarnings: 2.4,
      commissionRate: COMMISSION_RATE,
      scale: 3,
    });
    expect(split.storeEarnings).toBe(22.95);
    expect(split.riderTotal).toBe(2.76);
    expect(split.platformTotal).toBeCloseTo(3.291, 3);
    expect(split.platformTotal + split.storeEarnings + split.riderTotal).toBeCloseTo(29.001, 3);
  });
});

describe('Financial invariant campaign — seeded fuzz (200 random orders)', () => {
  // Deterministic PRNG so any failure reproduces.
  let seed = 0x1234abcd;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
  const money = (max: number, decimals = 3) => {
    const v = rand() * max;
    return Number(v.toFixed(Math.floor(rand() * (decimals + 1))));
  };

  it('holds all invariants across 200 randomized scenarios', async () => {
    for (let i = 0; i < 200; i++) {
      const scale = pick([2, 3]);
      const itemCount = 1 + Math.floor(rand() * 3);
      const items: Item[] = [];
      for (let j = 0; j < itemCount; j++) {
        const optCount = Math.floor(rand() * 3);
        items.push({
          price: money(40, scale),
          qty: 1 + Math.floor(rand() * (rand() < 0.1 ? 5000 : 6)),
          optionPrices: Array.from({ length: optCount }, () => money(5, scale)),
        });
      }
      const isPickedUp = rand() < 0.3;
      const scenario: Scenario = {
        items,
        scale,
        taxRate: pick([0, 7, 10, 13, 19]),
        offerDiscount: rand() < 0.4 ? money(20, scale) : 0,
        couponDiscount: rand() < 0.4 ? money(15, scale) : 0,
        couponClaim: true,
        loyaltyDiscount: rand() < 0.3 ? money(10, scale) : 0,
        loyaltyPoints: 100,
        tip: rand() < 0.5 ? money(5, scale) : 0,
        express: rand() < 0.3,
        expressSurcharge: 2,
        isPickedUp,
        delivery: isPickedUp
          ? undefined
          : { costType: pick(['fixed', 'perKM', 'tiered']), deliveryRate: money(3, scale), baseDeliveryFee: money(1, scale), baseDeliveryDistance: Math.floor(rand() * 3) },
      };

      let order: any;
      try {
        order = await place(scenario);
      } catch (err: any) {
        // A minimum-order rejection is a valid outcome, not a money bug.
        if (/Minimum order/.test(err?.message ?? '')) continue;
        throw new Error(`Fuzz #${i} threw: ${err?.message}\n${JSON.stringify(scenario)}`);
      }
      if (!order) continue;
      assertInvariants(order, scenario, `fuzz#${i}`);
    }
  });
});
