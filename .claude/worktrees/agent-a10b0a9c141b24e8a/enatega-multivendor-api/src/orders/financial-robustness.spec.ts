import { Types } from 'mongoose';
import { OrdersService } from './orders.service';
import { CouponsService } from '../coupons/coupons.service';

/**
 * Robustness campaign: concurrency, retries, rollback and reOrder — the ways a
 * real customer (or a flaky network) tries to make the money math misbehave.
 */

// ── A faithful in-memory coupon model that reproduces Mongo's atomic
//    findOneAndUpdate semantics (JS is single-threaded, so the guarded
//    check-and-increment runs to completion without interleaving). ──────────
function atomicCouponModel(initial: { _id: Types.ObjectId; usageLimit: number; timesUsed: number }) {
  const doc = { ...initial };
  return {
    doc,
    findOneAndUpdate: (filter: any) => {
      const usageLimit = filter.$expr.$lt[1];
      const ok = (doc.timesUsed ?? 0) < usageLimit && String(doc._id) === String(filter._id);
      if (ok) doc.timesUsed += 1;
      return { lean: () => ({ exec: () => Promise.resolve(ok ? { ...doc } : null) }) };
    },
    updateOne: (_filter: any, update: any) => {
      // release: decrement, floored at 0
      if (doc.timesUsed > 0) doc.timesUsed += update.$inc.timesUsed;
      return { exec: () => Promise.resolve({}) };
    },
  };
}

describe('CouponsService concurrency — single-use coupon under a stampede (CNC-03)', () => {
  it('exactly one of many concurrent claims wins a single-use coupon', async () => {
    const couponId = new Types.ObjectId();
    const model = atomicCouponModel({ _id: couponId, usageLimit: 1, timesUsed: 0 });
    const service = new CouponsService(model as never);

    const results = await Promise.all(
      Array.from({ length: 50 }, () => service.claimUse(couponId, 1)),
    );

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(model.doc.timesUsed).toBe(1);
  });

  it('exactly N claims win an N-use coupon, no over-redemption', async () => {
    const couponId = new Types.ObjectId();
    const model = atomicCouponModel({ _id: couponId, usageLimit: 5, timesUsed: 0 });
    const service = new CouponsService(model as never);

    const results = await Promise.all(
      Array.from({ length: 40 }, () => service.claimUse(couponId, 5)),
    );

    expect(results.filter(Boolean)).toHaveLength(5);
    expect(model.doc.timesUsed).toBe(5);
  });

  it('a released use can be reclaimed (cancel then re-order)', async () => {
    const couponId = new Types.ObjectId();
    const model = atomicCouponModel({ _id: couponId, usageLimit: 1, timesUsed: 0 });
    const service = new CouponsService(model as never);

    expect(await service.claimUse(couponId, 1)).toBe(true);
    expect(await service.claimUse(couponId, 1)).toBe(false); // exhausted
    await service.releaseUse(couponId); // order cancelled
    expect(await service.claimUse(couponId, 1)).toBe(true); // available again
  });
});

// ── placeOrder harness (WALLET + coupon), for rollback / reOrder tests ──────
function buildService(opts: {
  orderModel: any;
  couponsService: any;
  walletDebit?: jest.Mock;
  catalogVariationPresent?: boolean;
}) {
  const restaurantId = new Types.ObjectId();
  const userMongoId = new Types.ObjectId();
  const foodId = new Types.ObjectId();
  const variationId = new Types.ObjectId();

  const variations = opts.catalogVariationPresent === false ? [] : [{ _id: variationId, title: 'V', price: 10 }];
  const foods = [{ _id: foodId, title: 'F', variations }];

  const configurationModel = {
    findOne: jest.fn().mockReturnValue({
      lean: () => ({
        exec: () =>
          Promise.resolve({ currency: 'TND', currencyDecimalDigits: 3, costType: 'fixed', deliveryRate: 3 }),
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
      location: { coordinates: [10.76, 34.74] },
      categories: [{ foods }],
      addons: [],
      options: [],
    }),
    incrementOrderCounter: jest.fn().mockResolvedValue(1),
  };
  const catalogService = {
    getOrderPlacementCatalog: jest.fn().mockResolvedValue({ foods, addons: [], options: [] }),
    getFoodIdsForCategories: jest.fn().mockResolvedValue([]),
  };
  const customerWalletService = { debit: opts.walletDebit ?? jest.fn().mockResolvedValue(0) };
  const paymentAttempts = { recordSucceeded: jest.fn().mockResolvedValue(undefined) };
  const service = new OrdersService(
    opts.orderModel as never,
    {} as never,
    {} as never,
    configurationModel as never,
    { publish: jest.fn().mockResolvedValue(undefined) } as never,
    { resolveMongoIdByClerkId: jest.fn().mockResolvedValue(userMongoId) } as never,
    restaurantsService as never,
    {} as never,
    {} as never,
    { resolveActiveOffer: jest.fn().mockResolvedValue(null) } as never,
    { estimate: jest.fn().mockResolvedValue({ totalMinutes: 5 }) } as never,
    {} as never,
    {} as never,
    { redeemPoints: jest.fn() } as never,
    opts.couponsService as never,
    customerWalletService as never,
    { get: () => 'UTC' } as never,
    { findByPoint: jest.fn().mockResolvedValue(null) } as never,
    catalogService as never,
    paymentAttempts as never,
  );
  jest.spyOn(service as any, 'findOrderOrThrow').mockResolvedValue({ _id: new Types.ObjectId() });
  return { service, restaurantId, foodId, variationId };
}

describe('placeOrder rollback releases a claimed coupon (cancel during creation)', () => {
  it('a WALLET debit failure deletes the order AND releases the coupon use', async () => {
    const couponId = new Types.ObjectId();
    const orderModel = {
      create: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
      deleteOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(undefined) }),
    };
    const couponsService = {
      applyCoupon: jest.fn().mockResolvedValue({
        success: true,
        coupon: { _id: couponId, discount: 4, usageLimit: 1 },
      }),
      claimUse: jest.fn().mockResolvedValue(true),
      releaseUse: jest.fn().mockResolvedValue(undefined),
    };
    const walletDebit = jest.fn().mockRejectedValue(new Error('Insufficient funds'));
    const { service, restaurantId, foodId, variationId } = buildService({
      orderModel,
      couponsService,
      walletDebit,
    });

    await expect(
      service.placeOrder(
        'user_123',
        String(restaurantId),
        [{ food: String(foodId), variation: String(variationId), quantity: 1 }],
        'WALLET',
        0,
        0,
        { deliveryAddress: '1 St', longitude: '10.77', latitude: '34.75' },
        new Date('2026-06-29T09:00:00.000Z').toISOString(),
        false,
        0,
        undefined,
        'CODE',
      ),
    ).rejects.toThrow(/Insufficient funds/);

    expect(orderModel.deleteOne).toHaveBeenCalled();
    // The redemption we claimed for an order that never completed is given back.
    expect(couponsService.releaseUse).toHaveBeenCalledWith(couponId);
  });
});

describe('reOrder carries the same server authority (ITM guards apply)', () => {
  it('rejects re-ordering an item whose variation was deleted from the catalog', async () => {
    const foodId = new Types.ObjectId();
    const variationId = new Types.ObjectId();
    const userMongoId = new Types.ObjectId();
    const restaurantId = new Types.ObjectId();

    const storedOrder = {
      _id: new Types.ObjectId(),
      user: userMongoId,
      restaurant: restaurantId,
      items: [{ food: foodId, variation: variationId, quantity: 1, addons: [] }],
      taxationAmount: 1,
      instructions: '',
    };
    const orderModel = {
      findById: jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(storedOrder) }) }),
      create: jest.fn(),
    };
    const couponsService = {
      applyCoupon: jest.fn(),
      claimUse: jest.fn(),
      releaseUse: jest.fn(),
    };
    // Catalog no longer has the variation → buildOrderItem must reject.
    const { service } = buildService({ orderModel, couponsService, catalogVariationPresent: false });
    jest
      .spyOn(service as any, 'resolveUserMongoId')
      .mockResolvedValue(userMongoId);

    await expect(
      service.reOrder(
        'user_123',
        String(storedOrder._id),
        { deliveryAddress: '1 St', longitude: '10.77', latitude: '34.75' },
        0, // client deliveryCharges — ignored anyway
        0,
        false,
        'COD',
      ),
    ).rejects.toThrow(/no longer available/);
    expect(orderModel.create).not.toHaveBeenCalled();
  });
});
