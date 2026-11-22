import { Types } from 'mongoose';
import { OrdersService } from './orders.service';
import { Events } from '../subscriptions/events';

describe('OrdersService open-hours gate', () => {
  const makeService = () =>
    new OrdersService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { get: () => 'UTC' } as never,
      {} as never,
    );

  const monday0900Utc = new Date('2026-06-15T09:00:00Z'); // Monday
  const monday2300Utc = new Date('2026-06-15T23:00:00Z');

  const restaurant = (openingTimes: any[], extra: Record<string, unknown> = {}) => ({
    openingTimes,
    isAvailable: true,
    ...extra,
  });

  it('allows placement when the restaurant is open now', () => {
    const service = makeService();
    expect(() =>
      (service as any).assertRestaurantOpenAt(
        restaurant([{ day: 'MON', times: [{ startTime: '08:00', endTime: '17:00' }] }]),
        monday0900Utc,
      ),
    ).not.toThrow();
  });

  it('blocks placement when the restaurant is closed now', () => {
    const service = makeService();
    expect(() =>
      (service as any).assertRestaurantOpenAt(
        restaurant([{ day: 'MON', times: [{ startTime: '08:00', endTime: '17:00' }] }]),
        monday2300Utc,
      ),
    ).toThrow('Restaurant is currently closed');
  });

  it('blocks a scheduled order for a day the restaurant is closed', () => {
    const service = makeService();
    // Monday slot only; scheduled for a Tuesday → closed-today at that slot.
    const tuesday1200Utc = new Date('2026-06-16T12:00:00Z');
    expect(() =>
      (service as any).assertRestaurantOpenAt(
        restaurant([{ day: 'MON', times: [{ startTime: '08:00', endTime: '17:00' }] }]),
        tuesday1200Utc,
      ),
    ).toThrow('Restaurant is closed today');
  });

  it('blocks placement when the store is manually paused', () => {
    const service = makeService();
    expect(() =>
      (service as any).assertRestaurantOpenAt(
        restaurant([{ day: 'MON', times: [{ startTime: '00:00', endTime: '23:59' }] }], {
          isAvailable: false,
        }),
        monday0900Utc,
      ),
    ).toThrow('Restaurant is not accepting orders right now');
  });
});

describe('OrdersService authoritative delivery fallback', () => {
  const makeService = () =>
    new OrdersService(
      {} as never, {} as never, {} as never, {} as never, {} as never, {} as never,
      {} as never, {} as never, {} as never, {} as never, {} as never, {} as never,
      {} as never, {} as never, {} as never, {} as never, { get: () => 'UTC' } as never,
      {} as never,
    );

  it('applies rounding and caps to the missing-coordinate fallback', () => {
    const service = makeService();
    const fee = (service as any).resolveAuthoritativeDeliveryCharges(
      {},
      {
        costType: 'linear',
        deliveryRate: 7.26,
        deliveryRoundToNearest: 0.5,
        deliveryFeeMinimum: 2,
        deliveryFeeMaximum: 6,
      },
      undefined,
      false,
    );

    expect(fee).toBe(6);
  });

  it('never applies a fallback fee to a pickup order', () => {
    const service = makeService();
    expect(
      (service as any).resolveAuthoritativeDeliveryCharges(
        {},
        { deliveryRate: 7.26, deliveryFeeMinimum: 2 },
        undefined,
        true,
      ),
    ).toBe(0);
  });
});

describe('OrdersService placeOrder money normalization', () => {
  it('uses money arithmetic for item addons, coupons, and the final amount before persistence', async () => {
    const restaurantId = new Types.ObjectId();
    const userMongoId = new Types.ObjectId();
    const foodId = new Types.ObjectId();
    const variationId = new Types.ObjectId();
    const addonId = new Types.ObjectId();
    const optionId = new Types.ObjectId();
    const orderDoc = { _id: new Types.ObjectId() };

    const orderModel = {
      create: jest.fn().mockResolvedValue(orderDoc),
    };
    const configurationModel = {
      findOne: jest.fn().mockReturnValue({
        lean: () => ({
          exec: () =>
            Promise.resolve({
              currency: 'TND',
              currencyDecimalDigits: 3,
              loyaltyEnabled: true,
              loyaltyPointsRedemptionRate: 100,
              expressEnabled: true,
              expressSurcharge: 0,
            }),
        }),
      }),
    };
    const pubSub = { publish: jest.fn().mockResolvedValue(undefined) };
    const restaurantsService = {
      findOrderPlacementProfile: jest.fn().mockResolvedValue({
        _id: restaurantId,
        isActive: true,
        isAvailable: true,
        // Open every day so tests don't depend on the real weekday they run on.
        openingTimes: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day) => ({
          day,
          times: [{ startTime: '00:00', endTime: '23:59' }],
        })),
        timezone: 'UTC',
        orderPrefix: 'ORD-',
        deliveryTime: 0,
        categories: [
          {
            foods: [
              {
                _id: foodId,
                title: 'Soup',
                variations: [{ _id: variationId, title: 'Regular', price: 0.1 }],
              },
            ],
          },
        ],
        addons: [{ _id: addonId, title: 'Extras' }],
        options: [{ _id: optionId, title: 'Croutons', price: 0.2 }],
      }),
      incrementOrderCounter: jest.fn().mockResolvedValue(1),
    };
    const couponsService = {
      applyCoupon: jest.fn().mockResolvedValue({
        success: true,
        coupon: { discount: 0.1 },
      }),
    };
    const catalogService = {
      getOrderPlacementCatalog: jest.fn().mockResolvedValue({
        foods: [
          {
            _id: foodId,
            title: 'Soup',
            variations: [{ _id: variationId, title: 'Regular', price: 0.1 }],
          },
        ],
        addons: [{ _id: addonId, title: 'Extras' }],
        options: [{ _id: optionId, title: 'Croutons', price: 0.2 }],
      }),
      getFoodIdsForCategories: jest.fn().mockResolvedValue([]),
    };

    const service = new OrdersService(
      orderModel as never,
      {} as never,
      {} as never,
      configurationModel as never,
      pubSub as never,
      { resolveMongoIdByClerkId: jest.fn().mockResolvedValue(userMongoId) } as never,
      restaurantsService as never,
      {} as never,
      {} as never,
      { resolveActiveOffer: jest.fn().mockResolvedValue(null) } as never,
      {} as never,
      {} as never,
      {} as never,
      { redeemPoints: jest.fn() } as never,
      couponsService as never,
      {} as never,
      { get: () => 'UTC' } as never,
      {} as never,
      catalogService as never,
    );
    jest.spyOn(service as any, 'findOrderOrThrow').mockResolvedValue(orderDoc);

    await service.placeOrder(
      'user_123',
      String(restaurantId),
      [
        {
          food: String(foodId),
          variation: String(variationId),
          quantity: 1,
          addons: [{ _id: String(addonId), options: [String(optionId)] }],
        },
      ],
      'FLOUCI',
      0,
      0,
      { deliveryAddress: '123 Test St' },
      new Date('2026-06-29T09:00:00.000Z').toISOString(),
      false,
      0,
      undefined,
      'SAVE100',
    );

    expect(orderModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        discountAmount: 0.1,
        discountAmountMinor: 100,
        orderAmount: 0.2,
        orderAmountMinor: 200,
        orderAmountCurrency: 'TND',
        orderAmountScale: 3,
        deliveryChargesMinor: 0,
        tippingMinor: 0,
        taxationAmountMinor: 0,
        loyaltyDiscountMinor: 0,
        expressSurchargeMinor: 0,
      }),
    );
    expect(orderModel.create.mock.calls[0][0].orderAmount).not.toBe(0.19999999999999998);
    expect(couponsService.applyCoupon).toHaveBeenCalledWith('SAVE100', String(restaurantId));
    expect(configurationModel.findOne).toHaveBeenCalledWith(
      {},
      expect.stringContaining('currencyDecimalDigits'),
    );
  });

  it('records a succeeded payment attempt for wallet-settled orders', async () => {
    const restaurantId = new Types.ObjectId();
    const userMongoId = new Types.ObjectId();
    const foodId = new Types.ObjectId();
    const variationId = new Types.ObjectId();
    const orderDoc = { _id: new Types.ObjectId() };
    const orderModel = {
      create: jest.fn().mockResolvedValue(orderDoc),
      updateOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(undefined) }),
      deleteOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(undefined) }),
    };
    const configurationModel = {
      findOne: jest.fn().mockReturnValue({
        lean: () => ({
          exec: () =>
            Promise.resolve({
              currency: 'TND',
              currencyDecimalDigits: 3,
              loyaltyEnabled: true,
              loyaltyPointsRedemptionRate: 100,
              expressEnabled: true,
              expressSurcharge: 0,
            }),
        }),
      }),
    };
    const restaurantsService = {
      findOrderPlacementProfile: jest.fn().mockResolvedValue({
        _id: restaurantId,
        isActive: true,
        isAvailable: true,
        // Open every day so tests don't depend on the real weekday they run on.
        openingTimes: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day) => ({
          day,
          times: [{ startTime: '00:00', endTime: '23:59' }],
        })),
        timezone: 'UTC',
        orderPrefix: 'ORD-',
        deliveryTime: 0,
        categories: [
          {
            foods: [
              {
                _id: foodId,
                title: 'Soup',
                variations: [{ _id: variationId, title: 'Regular', price: 1.2345 }],
              },
            ],
          },
        ],
        addons: [],
        options: [],
      }),
      incrementOrderCounter: jest.fn().mockResolvedValue(1),
    };
    const customerWalletService = {
      debit: jest.fn().mockResolvedValue(0),
    };
    const paymentAttempts = {
      recordSucceeded: jest.fn().mockResolvedValue(undefined),
    };
    const catalogService = {
      getOrderPlacementCatalog: jest.fn().mockResolvedValue({
        foods: [
          {
            _id: foodId,
            title: 'Soup',
            variations: [{ _id: variationId, title: 'Regular', price: 1.2345 }],
          },
        ],
        addons: [],
        options: [],
      }),
      getFoodIdsForCategories: jest.fn().mockResolvedValue([]),
    };
    const pubSub = { publish: jest.fn().mockResolvedValue(undefined) };
    const service = new OrdersService(
      orderModel as never,
      {} as never,
      {} as never,
      configurationModel as never,
      pubSub as never,
      { resolveMongoIdByClerkId: jest.fn().mockResolvedValue(userMongoId) } as never,
      restaurantsService as never,
      {} as never,
      {} as never,
      { resolveActiveOffer: jest.fn().mockResolvedValue(null) } as never,
      {} as never,
      {} as never,
      {} as never,
      { redeemPoints: jest.fn() } as never,
      {} as never,
      customerWalletService as never,
      { get: () => 'UTC' } as never,
      {} as never,
      catalogService as never,
      paymentAttempts as never,
    );
    jest.spyOn(service as any, 'findOrderOrThrow').mockResolvedValue(orderDoc);

    await service.placeOrder(
      'user_123',
      String(restaurantId),
      [{ food: String(foodId), variation: String(variationId), quantity: 1 }],
      'WALLET',
      0,
      0,
      { deliveryAddress: '123 Test St' },
      new Date('2026-06-29T09:00:00.000Z').toISOString(),
      false,
      0,
    );

    expect(customerWalletService.debit).toHaveBeenCalledWith('user_123', 1.234, {
      order: orderDoc._id,
      reason: 'Order ORD-001',
    });
    expect(paymentAttempts.recordSucceeded).toHaveBeenCalledWith({
      subjectType: 'ORDER',
      subjectId: String(orderDoc._id),
      amountMinor: 1234,
      amountCurrency: 'TND',
      amountScale: 3,
      provider: 'WALLET',
      providerReference: `wallet:${String(orderDoc._id)}`,
      idempotencyKey: String(orderDoc._id),
      raw: {
        paymentMethod: 'WALLET',
        orderId: 'ORD-001',
        walletUserId: 'user_123',
      },
    });
  });

  it('publishes ORDER_PLACED without a zoneId at placement — riders are only broadcast at PREPARED', async () => {
    const restaurantId = new Types.ObjectId();
    const userMongoId = new Types.ObjectId();
    const foodId = new Types.ObjectId();
    const variationId = new Types.ObjectId();
    const zoneId = new Types.ObjectId();
    const orderDoc = { _id: new Types.ObjectId() };
    const orderModel = { create: jest.fn().mockResolvedValue(orderDoc) };
    const configurationModel = {
      findOne: jest.fn().mockReturnValue({
        lean: () => ({
          exec: () =>
            Promise.resolve({ currency: 'TND', currencyDecimalDigits: 3 }),
        }),
      }),
    };
    const restaurantsService = {
      findOrderPlacementProfile: jest.fn().mockResolvedValue({
        _id: restaurantId,
        isActive: true,
        isAvailable: true,
        // Open every day so the test doesn't depend on the real weekday.
        openingTimes: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day) => ({
          day,
          times: [{ startTime: '00:00', endTime: '23:59' }],
        })),
        timezone: 'UTC',
        orderPrefix: 'ORD-',
        deliveryTime: 0,
        // A real pickup point so the order resolves (and stores) a zone — the
        // point of this test is that the zone still must NOT leak into the
        // ORDER_PLACED payload, which is what the rider zone stream filters on.
        location: { coordinates: [10.76, 34.74] },
      }),
      incrementOrderCounter: jest.fn().mockResolvedValue(1),
      getPushIdentities: jest.fn().mockResolvedValue([]),
    };
    const catalogService = {
      getOrderPlacementCatalog: jest.fn().mockResolvedValue({
        foods: [
          {
            _id: foodId,
            title: 'Soup',
            variations: [{ _id: variationId, title: 'Regular', price: 1 }],
          },
        ],
        addons: [],
        options: [],
      }),
      getFoodIdsForCategories: jest.fn().mockResolvedValue([]),
    };
    const pubSub = { publish: jest.fn().mockResolvedValue(undefined) };
    const zonesService = { findByPoint: jest.fn().mockResolvedValue({ _id: zoneId }) };
    const service = new OrdersService(
      orderModel as never,
      {} as never,
      {} as never,
      configurationModel as never,
      pubSub as never,
      { resolveMongoIdByClerkId: jest.fn().mockResolvedValue(userMongoId) } as never,
      restaurantsService as never,
      {} as never,
      {} as never,
      { resolveActiveOffer: jest.fn().mockResolvedValue(null) } as never,
      {} as never,
      { createWebNotification: jest.fn().mockResolvedValue(undefined) } as never,
      {} as never,
      { redeemPoints: jest.fn() } as never,
      {} as never,
      {} as never,
      { get: () => 'UTC' } as never,
      zonesService as never,
      catalogService as never,
    );
    jest.spyOn(service as any, 'findOrderOrThrow').mockResolvedValue(orderDoc);

    await service.placeOrder(
      'user_123',
      String(restaurantId),
      [{ food: String(foodId), variation: String(variationId), quantity: 1 }],
      'COD',
      0,
      0,
      { deliveryAddress: '123 Test St' },
      new Date('2026-06-29T09:00:00.000Z').toISOString(),
      false,
      0,
    );

    // The order itself is zoned…
    expect(orderModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ zone: zoneId }),
    );
    // …but the placement event is store/admin-only: no zoneId, so the rider
    // zone subscription (which keys on payload.zoneId) never fires at PENDING.
    expect(pubSub.publish).toHaveBeenCalledTimes(1);
    const payload = pubSub.publish.mock.calls[0][1][Events.ORDER_PLACED];
    expect(payload.origin).toBe('new');
    expect(payload.restaurantId).toBe(String(restaurantId));
    expect(payload.zoneId).toBeUndefined();
  });

  // Builds an OrdersService wired for wallet placement with injectable wallet
  // and payment-attempt doubles, so the settlement/audit edge cases below can
  // share the verbose placement setup.
  const buildWalletService = (overrides: {
    debit?: jest.Mock;
    credit?: jest.Mock;
    recordSucceeded?: jest.Mock;
    updateOne?: jest.Mock;
  }) => {
    const restaurantId = new Types.ObjectId();
    const userMongoId = new Types.ObjectId();
    const foodId = new Types.ObjectId();
    const variationId = new Types.ObjectId();
    const orderDoc = { _id: new Types.ObjectId() };
    const orderModel = {
      create: jest.fn().mockResolvedValue(orderDoc),
      updateOne:
        overrides.updateOne ?? jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(undefined) }),
      deleteOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(undefined) }),
    };
    const configurationModel = {
      findOne: jest.fn().mockReturnValue({
        lean: () => ({
          exec: () =>
            Promise.resolve({
              currency: 'TND',
              currencyDecimalDigits: 3,
              loyaltyEnabled: true,
              loyaltyPointsRedemptionRate: 100,
              expressEnabled: true,
              expressSurcharge: 0,
            }),
        }),
      }),
    };
    const restaurantsService = {
      findOrderPlacementProfile: jest.fn().mockResolvedValue({
        _id: restaurantId,
        isActive: true,
        isAvailable: true,
        // Open every day so tests don't depend on the real weekday they run on.
        openingTimes: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day) => ({
          day,
          times: [{ startTime: '00:00', endTime: '23:59' }],
        })),
        timezone: 'UTC',
        orderPrefix: 'ORD-',
        deliveryTime: 0,
        categories: [
          {
            foods: [
              {
                _id: foodId,
                title: 'Soup',
                variations: [{ _id: variationId, title: 'Regular', price: 1.2345 }],
              },
            ],
          },
        ],
        addons: [],
        options: [],
      }),
      incrementOrderCounter: jest.fn().mockResolvedValue(1),
    };
    const customerWalletService = {
      debit: overrides.debit ?? jest.fn().mockResolvedValue(0),
      credit: overrides.credit ?? jest.fn().mockResolvedValue(0),
    };
    const paymentAttempts = {
      recordSucceeded: overrides.recordSucceeded ?? jest.fn().mockResolvedValue(undefined),
    };
    const catalogService = {
      getOrderPlacementCatalog: jest.fn().mockResolvedValue({
        foods: [
          {
            _id: foodId,
            title: 'Soup',
            variations: [{ _id: variationId, title: 'Regular', price: 1.2345 }],
          },
        ],
        addons: [],
        options: [],
      }),
      getFoodIdsForCategories: jest.fn().mockResolvedValue([]),
    };
    const pubSub = { publish: jest.fn().mockResolvedValue(undefined) };
    const service = new OrdersService(
      orderModel as never,
      {} as never,
      {} as never,
      configurationModel as never,
      pubSub as never,
      { resolveMongoIdByClerkId: jest.fn().mockResolvedValue(userMongoId) } as never,
      restaurantsService as never,
      {} as never,
      {} as never,
      { resolveActiveOffer: jest.fn().mockResolvedValue(null) } as never,
      {} as never,
      {} as never,
      {} as never,
      { redeemPoints: jest.fn() } as never,
      {} as never,
      customerWalletService as never,
      { get: () => 'UTC' } as never,
      {} as never,
      catalogService as never,
      paymentAttempts as never,
    );
    jest.spyOn(service as any, 'findOrderOrThrow').mockResolvedValue(orderDoc);

    const place = () =>
      service.placeOrder(
        'user_123',
        String(restaurantId),
        [{ food: String(foodId), variation: String(variationId), quantity: 1 }],
        'WALLET',
        0,
        0,
        { deliveryAddress: '123 Test St' },
        new Date('2026-06-29T09:00:00.000Z').toISOString(),
        false,
        0,
      );

    return { service, place, orderModel, orderDoc, customerWalletService, paymentAttempts, pubSub };
  };

  it('rolls the order back and records no attempt when the wallet debit fails', async () => {
    const debit = jest.fn().mockRejectedValue(new Error('insufficient funds'));
    const recordSucceeded = jest.fn().mockResolvedValue(undefined);
    const { place, orderModel, orderDoc, paymentAttempts } = buildWalletService({
      debit,
      recordSucceeded,
    });

    await expect(place()).rejects.toThrow('insufficient funds');

    expect(orderModel.deleteOne).toHaveBeenCalledWith({ _id: orderDoc._id });
    expect(paymentAttempts.recordSucceeded).not.toHaveBeenCalled();
  });

  it('reverses the wallet debit and rolls back the order when marking it PAID fails', async () => {
    const credit = jest.fn().mockResolvedValue(0);
    const updateOne = jest.fn().mockReturnValue({ exec: jest.fn().mockRejectedValue(new Error('db write failed')) });
    const { place, orderModel, orderDoc, customerWalletService } = buildWalletService({
      credit,
      updateOne,
    });

    await expect(place()).rejects.toThrow('db write failed');

    // The debit already succeeded (mocked to resolve), so the failure to mark
    // PAID must be compensated by crediting the money back, not just deleting
    // the order — otherwise the customer is charged for an order that never
    // existed.
    expect(customerWalletService.credit).toHaveBeenCalledWith(
      'user_123',
      expect.any(Number),
      expect.objectContaining({ order: orderDoc._id }),
    );
    expect(orderModel.deleteOne).toHaveBeenCalledWith({ _id: orderDoc._id });
  });

  it('still places the settled order when recording the audit attempt fails', async () => {
    const recordSucceeded = jest.fn().mockRejectedValue(new Error('audit store down'));
    const { place, orderDoc, pubSub } = buildWalletService({ recordSucceeded });

    const placed = await place();

    expect(placed).toEqual(orderDoc);
    expect(recordSucceeded).toHaveBeenCalled();
    // ORDER_PLACED is still published — the audit failure must not block the pipeline.
    expect(pubSub.publish).toHaveBeenCalled();
  });
});

describe('OrdersService dispatch orchestration', () => {
  it('includes unassigned prepared orders from the rider zone', async () => {
    const riderId = new Types.ObjectId();
    const zoneId = new Types.ObjectId();
    const orderModel = {
      find: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      }),
    };
    const service = new OrdersService(
      orderModel as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { get: () => 'UTC' } as never,
      {} as never,
    );

    await service.findVisibleForRider({ _id: riderId, zone: { _id: zoneId } } as never);

    expect(orderModel.find).toHaveBeenCalledWith({
      $or: [
        { rider: riderId },
        {
          rider: null,
          zone: zoneId,
          orderStatus: { $in: ['ACCEPTED', 'PREPARED'] },
          isPickedUp: { $ne: true },
        },
      ],
    });
  });

  it('resolves the order zone from the restaurant location', async () => {
    const zoneId = new Types.ObjectId();
    const staleZoneId = new Types.ObjectId();
    const zonesService = {
      findByPoint: jest.fn().mockResolvedValue({ _id: zoneId }),
    };
    const service = new OrdersService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { get: () => 'UTC' } as never,
      zonesService as never,
    );

    await expect(
      (service as any).resolveOrderZoneId({
        zone: staleZoneId,
        location: { coordinates: [10.53806177558406, 52.24634903376355] },
      }),
    ).resolves.toBe(String(zoneId));
    expect(zonesService.findByPoint).toHaveBeenCalledWith(10.53806177558406, 52.24634903376355);
  });

  it('routes assigned-rider push through Notifications without using Dispatch', async () => {
    const orderId = new Types.ObjectId();
    const riderId = new Types.ObjectId();
    const populated = {
      _id: orderId,
      restaurant: { name: 'Löwenstadt Pizza' },
      orderAmount: 42,
    };
    const orderModel = {
      findByIdAndUpdate: jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve({ _id: orderId }) }),
      }),
    };
    const trackingService = { terminateOrderTracking: jest.fn().mockResolvedValue(undefined) };
    const pubSub = { publish: jest.fn().mockResolvedValue(undefined) };
    const notificationsService = {
      sendIncomingOrderPushToRider: jest.fn().mockResolvedValue(true),
    };
    const ridersService = {
      findById: jest.fn().mockResolvedValue({ notificationToken: 'expo-token' }),
    };
    const dispatchService = { notifyNearbyRiders: jest.fn() };
    const service = new OrdersService(
      orderModel as never,
      {} as never,
      {} as never,
      {} as never,
      pubSub as never,
      {} as never,
      {} as never,
      ridersService as never,
      trackingService as never,
      {} as never,
      {} as never,
      notificationsService as never,
      dispatchService as never,
      {} as never,
      {} as never,
      {} as never,
      { get: () => 'UTC' } as never,
      {} as never,
    );
    jest.spyOn(service as any, 'findOrderOrThrow').mockResolvedValue(populated);

    await service.assignRider(String(orderId), String(riderId));

    expect(notificationsService.sendIncomingOrderPushToRider).toHaveBeenCalledWith({
      riderId: String(riderId),
      notificationToken: 'expo-token',
      orderId: String(orderId),
      restaurantName: 'Löwenstadt Pizza',
      orderAmount: 42,
    });
    expect(dispatchService.notifyNearbyRiders).not.toHaveBeenCalled();
  });

  it.each([
    { isExpress: false, radiusKm: 8, reason: 'prepared' },
    { isExpress: true, radiusKm: 15, reason: 'prepared_express' },
  ])(
    'maps prepared order dispatch for isExpress=$isExpress',
    async ({ isExpress, radiusKm, reason }) => {
      const orderId = new Types.ObjectId();
      const restaurantId = new Types.ObjectId();
      const zoneId = new Types.ObjectId();
      const orderModel = {
        findById: jest.fn().mockReturnValue({
          lean: () => ({
            exec: () =>
              Promise.resolve({
                restaurant: restaurantId,
                deliveryCharges: 10,
                orderStatus: 'ACCEPTED',
                zone: zoneId,
              }),
          }),
        }),
        findOneAndUpdate: jest.fn().mockReturnValue({
          lean: () => ({ exec: () => Promise.resolve({ _id: orderId }) }),
        }),
      };
      const configurationModel = {
        findOne: jest.fn().mockReturnValue({
          lean: () => ({ exec: () => Promise.resolve({ riderCommissionRate: 0.1 }) }),
        }),
      };
      const pubSub = { publish: jest.fn().mockResolvedValue(undefined) };
      const dispatchService = { notifyNearbyRiders: jest.fn().mockResolvedValue({}) };
      const prepared = { _id: orderId, restaurant: restaurantId, zone: zoneId, isExpress };
      const service = new OrdersService(
        orderModel as never,
        {} as never,
        {} as never,
        configurationModel as never,
        pubSub as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        dispatchService as never,
        {} as never,
        {} as never,
        {} as never,
        { get: () => 'UTC' } as never,
        {} as never,
      );
      jest.spyOn(service as any, 'findOrderOrThrow').mockResolvedValue(prepared);

      await service.markOrderPrepared(String(orderId), String(restaurantId));

      expect(dispatchService.notifyNearbyRiders).toHaveBeenCalledWith({
        orderId: String(orderId),
        restaurantId: String(restaurantId),
        zoneId: String(zoneId),
        radiusKm,
        reason,
      });
    },
  );

  it('publishes ORDER_PLACED with the real zone id string, not a populated zone object, so subscriptionZoneOrders can match it', async () => {
    // Regression test: findOrderOrThrow populates `zone` to { _id, title }
    // (POPULATE_ZONE). A bare `.zone?.toString()` on that shape stringifies
    // the OBJECT ("[object Object]") instead of the id, silently breaking the
    // rider zone-broadcast filter (payload.zoneId === variables.zoneId never
    // matches) while every other assertion in this file still passes because
    // they mock `zone` as a raw (unpopulated) ObjectId.
    const orderId = new Types.ObjectId();
    const restaurantId = new Types.ObjectId();
    const zoneId = new Types.ObjectId();
    const orderModel = {
      findById: jest.fn().mockReturnValue({
        lean: () => ({
          exec: () =>
            Promise.resolve({
              restaurant: restaurantId,
              deliveryCharges: 10,
              orderStatus: 'ACCEPTED',
              zone: zoneId,
            }),
        }),
      }),
      findOneAndUpdate: jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve({ _id: orderId }) }),
      }),
    };
    const configurationModel = {
      findOne: jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve({ riderCommissionRate: 0.1 }) }),
      }),
    };
    const pubSub = { publish: jest.fn().mockResolvedValue(undefined) };
    const dispatchService = { notifyNearbyRiders: jest.fn().mockResolvedValue({}) };
    // The realistic populated shape findOrderOrThrow actually returns.
    const prepared = {
      _id: orderId,
      restaurant: restaurantId,
      zone: { _id: zoneId, title: 'Sfax Ville' },
      isExpress: false,
    };
    const service = new OrdersService(
      orderModel as never,
      {} as never,
      {} as never,
      configurationModel as never,
      pubSub as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      dispatchService as never,
      {} as never,
      {} as never,
      {} as never,
      { get: () => 'UTC' } as never,
      {} as never,
    );
    jest.spyOn(service as any, 'findOrderOrThrow').mockResolvedValue(prepared);

    await service.markOrderPrepared(String(orderId), String(restaurantId));

    expect(pubSub.publish).toHaveBeenCalledWith(
      Events.ORDER_PLACED,
      expect.objectContaining({
        [Events.ORDER_PLACED]: expect.objectContaining({ zoneId: String(zoneId) }),
      }),
    );
  });

  it('maps escalation dispatch to the escalation radius and reason', async () => {
    const orderId = new Types.ObjectId();
    const restaurantId = new Types.ObjectId();
    const zoneId = new Types.ObjectId();
    const orderModel = {
      find: jest.fn().mockReturnValue({
        lean: () => ({
          exec: () => Promise.resolve([{ _id: orderId, restaurant: restaurantId, zone: zoneId }]),
        }),
      }),
    };
    const dispatchService = { notifyNearbyRiders: jest.fn().mockResolvedValue({}) };
    const service = new OrdersService(
      orderModel as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      dispatchService as never,
      {} as never,
      {} as never,
      {} as never,
      { get: () => 'UTC' } as never,
      {} as never,
    );

    await service.escalateUnassignedPreparedOrders();

    expect(dispatchService.notifyNearbyRiders).toHaveBeenCalledWith({
      orderId: String(orderId),
      restaurantId: String(restaurantId),
      zoneId: String(zoneId),
      radiusKm: 15,
      reason: 'escalation',
    });
  });

  it('getOrdersNeedingAttention queries unassigned PREPARED/ACCEPTED orders past the threshold', async () => {
    const query = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([{ _id: new Types.ObjectId() }]),
    };
    const orderModel = { find: jest.fn().mockReturnValue(query) };
    const service = new OrdersService(
      orderModel as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { get: () => 'UTC' } as never,
      {} as never,
    );

    const result = await service.getOrdersNeedingAttention(10);

    expect(orderModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        rider: null,
        $or: [
          { orderStatus: 'PREPARED', preparedAt: { $lte: expect.any(String) } },
          { orderStatus: 'ACCEPTED', acceptedAt: { $lte: expect.any(String) } },
        ],
      }),
    );
    expect(result).toHaveLength(1);
  });
});

describe('OrdersService customer order queries', () => {
  it('includes legacy pending orders without orderStatus in active orders', async () => {
    const userMongoId = new Types.ObjectId();
    const query = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    const orderModel = {
      find: jest.fn().mockReturnValue(query),
    };
    const usersService = {
      resolveMongoIdByClerkId: jest.fn().mockResolvedValue(userMongoId),
    };
    const service = new OrdersService(
      orderModel as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      usersService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { get: () => 'UTC' } as never,
      {} as never,
    );

    await service.getUsersActiveOrders('clerk_user', 1, 10, 0);

    expect(orderModel.find).toHaveBeenCalledWith({
      user: userMongoId,
      $or: [
        {
          orderStatus: {
            $in: ['PENDING', 'ACCEPTED', 'PREPARED', 'AWAITING_RIDER', 'ASSIGNED', 'PICKED', 'ARRIVED'],
          },
        },
        { orderStatus: { $exists: false }, status: 'pending' },
        { orderStatus: null, status: 'pending' },
      ],
    });
  });
});

describe('OrdersService activateScheduledOrders safety net (path b)', () => {
  // Monday 23:00 UTC — outside the only MON slot (08:00–17:00), so a restaurant
  // with that schedule is closed at activation time.
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-15T23:00:00Z'));
  });
  afterAll(() => jest.useRealTimers());

  const closedSchedule = [{ day: 'MON', times: [{ startTime: '08:00', endTime: '17:00' }] }];

  const makeService = (restaurantDoc: Record<string, unknown> | null) => {
    const dueOrder = {
      _id: new Types.ObjectId(),
      restaurant: new Types.ObjectId(),
      zone: new Types.ObjectId(),
      user: new Types.ObjectId(),
    };
    const findByIdAndUpdate = jest.fn().mockReturnValue({ exec: () => Promise.resolve({}) });
    const orderModel = {
      find: jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve([dueOrder]) }),
      }),
      findByIdAndUpdate,
    };
    const restaurantsService = {
      findOrderOpenStatusInputs: jest.fn().mockResolvedValue(restaurantDoc),
    };
    const usersService = { findClerkIdByMongoId: jest.fn().mockResolvedValue(null) };
    const publish = jest.fn().mockResolvedValue(undefined);
    const service = new OrdersService(
      orderModel as never,
      {} as never,
      {} as never,
      {} as never,
      { publish } as never,
      usersService as never,
      restaurantsService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { get: () => 'UTC' } as never,
      {} as never,
    );
    (service as any).logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    return { service, orderModel, publish, dueOrder };
  };

  it('flags a closed restaurant SCHEDULED_UNFULFILLED and does not publish ORDER_PLACED', async () => {
    const { service, orderModel, publish, dueOrder } = makeService({
      isActive: true,
      isAvailable: true,
      openingTimes: closedSchedule,
      timezone: 'UTC',
    });

    await service.activateScheduledOrders();

    expect(orderModel.findByIdAndUpdate).toHaveBeenCalledWith(
      String(dueOrder._id),
      { $set: { orderStatus: 'SCHEDULED_UNFULFILLED', status: 'pending' } },
    );
    expect(publish).not.toHaveBeenCalled();
  });

  it('does not publish ORDER_PLACED when the store is paused at activation', async () => {
    const { service, publish } = makeService({
      isActive: true,
      isAvailable: false, // paused between scheduling and activation
      // Open every day so tests don't depend on the real weekday they run on.
        openingTimes: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day) => ({
          day,
          times: [{ startTime: '00:00', endTime: '23:59' }],
        })),
      timezone: 'UTC',
    });

    await service.activateScheduledOrders();

    expect(publish).not.toHaveBeenCalled();
  });
});

describe('OrdersService finalizeDeliveryIfBothConfirmed rider credit', () => {
  const bothConfirmed = '2026-06-15T10:00:00Z';

  const makeService = ({
    riderCommission,
    rate,
    deliveryCharges = 10,
  }: {
    riderCommission?: number;
    rate: number;
    deliveryCharges?: number;
  }) => {
    const orderId = new Types.ObjectId();
    const riderId = new Types.ObjectId();
    const order: Record<string, unknown> = {
      _id: orderId,
      customerDeliveredAt: bothConfirmed,
      riderDeliveredAt: bothConfirmed,
      orderStatus: 'PICKED',
      deliveryCharges,
      rider: riderId,
      // no `user` → loyalty branch is skipped
    };
    if (riderCommission !== undefined) order.riderCommission = riderCommission;

    const orderModel = {
      findById: jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(order) }),
      }),
      findOneAndUpdate: jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve({ _id: orderId }) }),
      }),
      findByIdAndUpdate: jest.fn().mockReturnValue({ exec: () => Promise.resolve({}) }),
    };
    const riderModel = { findByIdAndUpdate: jest.fn().mockResolvedValue({}) };
    const configurationModel = {
      findOne: jest.fn().mockReturnValue({
        lean: () => ({
          exec: () =>
            Promise.resolve({
              riderCommissionRate: rate,
              currency: 'TND',
              currencyDecimalDigits: 3,
            }),
        }),
      }),
    };
    const pubSub = { publish: jest.fn().mockResolvedValue(undefined) };
    const trackingService = { terminateOrderTracking: jest.fn().mockResolvedValue(undefined) };
    const service = new OrdersService(
      orderModel as never,
      {} as never,
      riderModel as never,
      configurationModel as never,
      pubSub as never,
      {} as never,
      {} as never,
      {} as never,
      trackingService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { get: () => 'UTC' } as never,
      {} as never,
    );
    jest.spyOn(service as any, 'publishOrderStatusChanged').mockResolvedValue(undefined);
    return { service, orderModel, riderModel, orderId, riderId };
  };

  it('recomputes from the current rate when the frozen commission is 0', async () => {
    const { service, orderModel, riderModel, orderId, riderId } = makeService({
      riderCommission: 0,
      rate: 0.8,
      deliveryCharges: 10,
    });

    await service.finalizeDeliveryIfBothConfirmed(String(orderId));

    // 10 * 0.8 = 8 written to the order and credited to the rider wallet.
    expect(orderModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ walletCredited: { $ne: true } }),
      {
        $set: expect.objectContaining({
          orderStatus: 'DELIVERED',
          walletCredited: true,
          riderEarnings: 8,
          riderEarningsMinor: 8000,
        }),
      },
      { new: true },
    );
    expect(riderModel.findByIdAndUpdate).toHaveBeenCalledWith(riderId, {
      $inc: { currentWalletAmount: 8, totalWalletAmount: 8 },
    });
  });

  it('honors a frozen positive commission instead of the current rate', async () => {
    const { service, orderModel, riderModel, orderId, riderId } = makeService({
      riderCommission: 5,
      rate: 0.8,
      deliveryCharges: 10,
    });

    await service.finalizeDeliveryIfBothConfirmed(String(orderId));

    // Frozen 5 is used as-is (not the 8 the current rate would produce).
    expect(orderModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      { $set: expect.objectContaining({ riderEarnings: 5, riderEarningsMinor: 5000 }) },
      { new: true },
    );
    expect(riderModel.findByIdAndUpdate).toHaveBeenCalledWith(riderId, {
      $inc: { currentWalletAmount: 5, totalWalletAmount: 5 },
    });
  });

  it('does not credit the wallet when rate is 0 and no commission is frozen', async () => {
    const { service, riderModel, orderId } = makeService({
      rate: 0,
      deliveryCharges: 10,
    });

    await service.finalizeDeliveryIfBothConfirmed(String(orderId));

    expect(riderModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('quantizes rider earnings at the configured currency scale', async () => {
    const { service, orderModel, riderModel, orderId, riderId } = makeService({
      rate: 0.125,
      deliveryCharges: 1,
    });

    await service.finalizeDeliveryIfBothConfirmed(String(orderId));

    expect(orderModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      { $set: expect.objectContaining({ riderEarnings: 0.125, riderEarningsMinor: 125 }) },
      { new: true },
    );
    expect(riderModel.findByIdAndUpdate).toHaveBeenCalledWith(riderId, {
      $inc: { currentWalletAmount: 0.125, totalWalletAmount: 0.125 },
    });
  });
});

describe('OrdersService placeOrder — server-authoritative delivery & tax (DLV/TAX)', () => {
  // A restaurant open 24/7 with a real pickup point and a configured tax rate.
  // costType 'fixed' makes the expected delivery fee deterministic (== deliveryRate)
  // regardless of distance, so the assertions are about *authority*, not geometry.
  const buildService = (orderModel: any) => {
    const restaurantId = new Types.ObjectId();
    const userMongoId = new Types.ObjectId();
    const foodId = new Types.ObjectId();
    const variationId = new Types.ObjectId();

    const configurationModel = {
      findOne: jest.fn().mockReturnValue({
        lean: () => ({
          exec: () =>
            Promise.resolve({
              currency: 'TND',
              currencyDecimalDigits: 3,
              loyaltyEnabled: true,
              loyaltyPointsRedemptionRate: 100,
              expressEnabled: true,
              expressSurcharge: 0,
              costType: 'fixed',
              deliveryRate: 3, // flat 3.000 DT
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
        tax: 10, // 10% configured tax
        location: { coordinates: [10.76, 34.74] },
        categories: [
          { foods: [{ _id: foodId, title: 'Soup', variations: [{ _id: variationId, title: 'Reg', price: 10 }] }] },
        ],
        addons: [],
        options: [],
      }),
      incrementOrderCounter: jest.fn().mockResolvedValue(1),
      getPushIdentities: jest.fn().mockResolvedValue([]),
    };
    const catalogService = {
      getOrderPlacementCatalog: jest.fn().mockResolvedValue({
        foods: [{ _id: foodId, title: 'Soup', variations: [{ _id: variationId, title: 'Reg', price: 10 }] }],
        addons: [],
        options: [],
      }),
      getFoodIdsForCategories: jest.fn().mockResolvedValue([]),
    };
    const pubSub = { publish: jest.fn().mockResolvedValue(undefined) };
    const zonesService = { findByPoint: jest.fn().mockResolvedValue(null) };

    const service = new OrdersService(
      orderModel as never,
      {} as never,
      {} as never,
      configurationModel as never,
      pubSub as never,
      { resolveMongoIdByClerkId: jest.fn().mockResolvedValue(userMongoId) } as never,
      restaurantsService as never,
      {} as never,
      {} as never,
      { resolveActiveOffer: jest.fn().mockResolvedValue(null) } as never,
      {} as never,
      { createWebNotification: jest.fn().mockResolvedValue(undefined) } as never,
      {} as never,
      { redeemPoints: jest.fn() } as never,
      {} as never,
      {} as never,
      { get: () => 'UTC' } as never,
      zonesService as never,
      catalogService as never,
    );
    jest.spyOn(service as any, 'findOrderOrThrow').mockResolvedValue({ _id: new Types.ObjectId() });
    return { service, foodId, variationId, restaurantId };
  };

  // A delivery order to a real address, with HOSTILE client-supplied
  // deliveryCharges/taxationAmount that the server must ignore.
  const placeWith = (
    service: OrdersService,
    ids: { foodId: Types.ObjectId; variationId: Types.ObjectId; restaurantId: Types.ObjectId },
    hostileDelivery: number,
    hostileTax: number,
    isPickedUp = false,
  ) =>
    service.placeOrder(
      'user_123',
      String(ids.restaurantId),
      [{ food: String(ids.foodId), variation: String(ids.variationId), quantity: 1 }],
      'COD',
      0, // tipping
      hostileTax, // taxationAmount (client) — must be ignored
      { deliveryAddress: '123 Test St', longitude: '10.77', latitude: '34.75' },
      new Date('2026-06-29T09:00:00.000Z').toISOString(),
      isPickedUp,
      hostileDelivery, // deliveryCharges (client) — must be ignored
    );

  it('ignores a client deliveryCharges of 0 and charges the configured fee', async () => {
    const orderModel = { create: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }) };
    const { service, foodId, variationId, restaurantId } = buildService(orderModel);

    await placeWith(service, { foodId, variationId, restaurantId }, 0, 999);

    const persisted = orderModel.create.mock.calls[0][0];
    expect(persisted.deliveryCharges).toBe(3);
    expect(persisted.deliveryChargesMinor).toBe(3000);
  });

  it('ignores a negative client deliveryCharges (no free/negative delivery)', async () => {
    const orderModel = { create: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }) };
    const { service, foodId, variationId, restaurantId } = buildService(orderModel);

    await placeWith(service, { foodId, variationId, restaurantId }, -50, 0);

    const persisted = orderModel.create.mock.calls[0][0];
    expect(persisted.deliveryCharges).toBe(3);
    expect(persisted.deliveryChargesMinor).toBe(3000);
  });

  it('computes tax from the restaurant rate, ignoring the client taxationAmount', async () => {
    const orderModel = { create: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }) };
    const { service, foodId, variationId, restaurantId } = buildService(orderModel);

    // subtotal 10.000 × 10% = 1.000 tax, whatever the client claims.
    await placeWith(service, { foodId, variationId, restaurantId }, 3, 999);

    const persisted = orderModel.create.mock.calls[0][0];
    expect(persisted.taxationAmount).toBe(1);
    expect(persisted.taxationAmountMinor).toBe(1000);
  });

  it('rejects a negative client taxationAmount as a hidden discount', async () => {
    const orderModel = { create: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }) };
    const { service, foodId, variationId, restaurantId } = buildService(orderModel);

    await placeWith(service, { foodId, variationId, restaurantId }, 3, -999);

    const persisted = orderModel.create.mock.calls[0][0];
    // Tax stays authoritative (+1.000), never the client's −999 that would slash the total.
    expect(persisted.taxationAmount).toBe(1);
    // total = food 10 + delivery 3 + tax 1 = 14.000
    expect(persisted.orderAmount).toBe(14);
    expect(persisted.orderAmountMinor).toBe(14000);
  });

  it('charges no delivery fee for pickup orders even if the client sends a fee', async () => {
    const orderModel = { create: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }) };
    const { service, foodId, variationId, restaurantId } = buildService(orderModel);

    await placeWith(service, { foodId, variationId, restaurantId }, 999, 0, true);

    const persisted = orderModel.create.mock.calls[0][0];
    expect(persisted.deliveryCharges).toBe(0);
    expect(persisted.deliveryChargesMinor).toBe(0);
  });
});

describe('OrdersService buildOrderItem — quantity & catalog authority (ITM)', () => {
  const makeBareService = () =>
    new OrdersService(
      {} as never, {} as never, {} as never, {} as never, {} as never,
      {} as never, {} as never, {} as never, {} as never, {} as never,
      {} as never, {} as never, {} as never, {} as never, {} as never,
      {} as never, { get: () => 'UTC' } as never, {} as never, {} as never,
    );

  const foodId = new Types.ObjectId();
  const variationId = new Types.ObjectId();
  const catalog = {
    foods: [{ _id: foodId, title: 'Soup', variations: [{ _id: variationId, title: 'Reg', price: 10 }] }],
    addons: [],
    options: [],
  };
  const build = (input: any) => (makeBareService() as any).buildOrderItem(input, catalog);

  it('ITM-03: a negative quantity is rejected (never credits the customer)', () => {
    expect(() => build({ food: String(foodId), variation: String(variationId), quantity: -3 })).toThrow(
      /Invalid item quantity/,
    );
  });

  it('ITM-02: a zero quantity is rejected (no phantom line)', () => {
    expect(() => build({ food: String(foodId), variation: String(variationId), quantity: 0 })).toThrow(
      /Invalid item quantity/,
    );
  });

  it('ITM-14: a fractional quantity is rejected', () => {
    expect(() => build({ food: String(foodId), variation: String(variationId), quantity: 2.5 })).toThrow(
      /Invalid item quantity/,
    );
  });

  it('ITM-09: an unknown/deleted food is rejected (not silently priced at 0)', () => {
    expect(() =>
      build({ food: String(new Types.ObjectId()), variation: String(variationId), quantity: 1 }),
    ).toThrow(/no longer available/);
  });

  it('ITM-11: an unknown/deleted variation is rejected', () => {
    expect(() =>
      build({ food: String(foodId), variation: String(new Types.ObjectId()), quantity: 1 }),
    ).toThrow(/option is no longer available/);
  });

  it('ITM-01: a valid item is priced from the catalog (client cannot inject a price)', () => {
    const item = build({ food: String(foodId), variation: String(variationId), quantity: 2 });
    expect(item.quantity).toBe(2);
    expect(item.variation.price).toBe(10); // from catalog, not from the payload
  });
});

describe('OrdersService placeOrder — usage-limited coupons (CPN-06/CNC-03)', () => {
  const buildOrder = (claimUseResult: boolean, orderModel: any) => {
    const restaurantId = new Types.ObjectId();
    const userMongoId = new Types.ObjectId();
    const foodId = new Types.ObjectId();
    const variationId = new Types.ObjectId();
    const couponId = new Types.ObjectId();

    const configurationModel = {
      findOne: jest.fn().mockReturnValue({
        lean: () => ({
          exec: () => Promise.resolve({ currency: 'TND', currencyDecimalDigits: 3 }),
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
        categories: [
          { foods: [{ _id: foodId, title: 'Soup', variations: [{ _id: variationId, title: 'Reg', price: 10 }] }] },
        ],
        addons: [],
        options: [],
      }),
      incrementOrderCounter: jest.fn().mockResolvedValue(1),
    };
    const catalogService = {
      getOrderPlacementCatalog: jest.fn().mockResolvedValue({
        foods: [{ _id: foodId, title: 'Soup', variations: [{ _id: variationId, title: 'Reg', price: 10 }] }],
        addons: [],
        options: [],
      }),
      getFoodIdsForCategories: jest.fn().mockResolvedValue([]),
    };
    const couponsService = {
      applyCoupon: jest.fn().mockResolvedValue({
        success: true,
        coupon: { _id: couponId, discount: 4, usageLimit: 1 },
      }),
      claimUse: jest.fn().mockResolvedValue(claimUseResult),
      releaseUse: jest.fn().mockResolvedValue(undefined),
    };
    const pubSub = { publish: jest.fn().mockResolvedValue(undefined) };
    const service = new OrdersService(
      orderModel as never,
      {} as never,
      {} as never,
      configurationModel as never,
      pubSub as never,
      { resolveMongoIdByClerkId: jest.fn().mockResolvedValue(userMongoId) } as never,
      restaurantsService as never,
      {} as never,
      {} as never,
      { resolveActiveOffer: jest.fn().mockResolvedValue(null) } as never,
      {} as never,
      {} as never,
      {} as never,
      { redeemPoints: jest.fn() } as never,
      couponsService as never,
      {} as never,
      { get: () => 'UTC' } as never,
      {} as never,
      catalogService as never,
    );
    jest.spyOn(service as any, 'findOrderOrThrow').mockResolvedValue({ _id: new Types.ObjectId() });
    return { service, foodId, variationId, restaurantId, couponId, couponsService };
  };

  const place = (service: OrdersService, ids: any) =>
    service.placeOrder(
      'user_123',
      String(ids.restaurantId),
      [{ food: String(ids.foodId), variation: String(ids.variationId), quantity: 1 }],
      'COD',
      0,
      0,
      { deliveryAddress: '123 Test St' },
      new Date('2026-06-29T09:00:00.000Z').toISOString(),
      true, // pickup so delivery is 0 and the total is just food − coupon
      0,
      undefined,
      'WELCOME',
    );

  it('applies a single-use coupon and records the claimed coupon id', async () => {
    const orderModel = { create: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }) };
    const ctx = buildOrder(true, orderModel);
    await place(ctx.service, ctx);

    expect(ctx.couponsService.claimUse).toHaveBeenCalledWith(ctx.couponId, 1);
    const persisted = orderModel.create.mock.calls[0][0];
    expect(persisted.couponCode).toBe('WELCOME');
    expect(persisted.coupon).toBe(ctx.couponId);
    expect(persisted.discountAmount).toBe(4); // 10 food − 4 coupon
    expect(persisted.orderAmount).toBe(6);
  });

  it('does NOT apply an exhausted single-use coupon (order still placed at full price)', async () => {
    const orderModel = { create: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }) };
    const ctx = buildOrder(false, orderModel);
    await place(ctx.service, ctx);

    const persisted = orderModel.create.mock.calls[0][0];
    expect(persisted.couponCode).toBeUndefined();
    expect(persisted.coupon).toBeUndefined();
    expect(persisted.discountAmount).toBe(0);
    expect(persisted.orderAmount).toBe(10); // full price, no discount
  });
});

// ── FIN-07: refund-on-cancel must cover every captured payment method, not ──
// only WALLET. Regression coverage for a bug found during the P0 test-coverage
// audit: abortOrder/cancelOrder/updateStatus all gated their auto-refund on
// `paymentMethod === 'WALLET'`, so a cancelled order paid online (FLOUCI) was
// left CANCELLED + paymentStatus PAID — the customer's money stayed captured
// with no automatic refund. Fixed to key off `paymentStatus === 'PAID'`,
// matching the already-correct admin `refundOrderToWallet` mutation.
describe('OrdersService — refund on cancellation covers online payments (FIN-07)', () => {
  /** Chainable Mongoose query stub: populate()/select() return itself, exec() resolves. */
  const chain = (resolved: unknown) => {
    const q: any = {};
    q.populate = jest.fn(() => q);
    q.select = jest.fn(() => q);
    q.lean = jest.fn(() => q);
    q.exec = jest.fn().mockResolvedValue(resolved);
    return q;
  };

  const userMongoId = new Types.ObjectId();
  // `user` doubles as both the raw ref abortOrder's ownership check compares
  // via String(order.user) (custom toString) and the populated shape
  // cancelOrder/updateStatus read `.clerkId` off (findOrderOrThrow-style).
  const user = {
    _id: userMongoId,
    clerkId: 'user_clerk_1',
    toString: () => userMongoId.toString(),
  };

  const baseOrder = (overrides: Record<string, unknown>) => ({
    _id: new Types.ObjectId(),
    user,
    restaurant: new Types.ObjectId(),
    orderStatus: 'PENDING',
    paymentMethod: 'FLOUCI',
    paymentStatus: 'PAID',
    paidAmount: 42.5,
    orderAmount: 42.5,
    ...overrides,
  });

  const buildService = (order: Record<string, unknown>) => {
    const orderModel = {
      findById: jest.fn().mockReturnValue(chain(order)),
      findByIdAndUpdate: jest.fn().mockReturnValue(chain(order)),
    };
    const customerWalletService = { credit: jest.fn().mockResolvedValue(undefined) };
    const usersService = {
      resolveMongoIdByClerkId: jest.fn().mockResolvedValue(userMongoId),
    };
    const couponsService = { releaseUse: jest.fn().mockResolvedValue(undefined) };
    const loyaltyService = { refundPoints: jest.fn().mockResolvedValue(undefined) };
    const pubSub = { publish: jest.fn().mockResolvedValue(undefined) };
    const trackingService = { terminateOrderTracking: jest.fn().mockResolvedValue(undefined) };
    const notificationsService = { sendPushToUser: jest.fn().mockResolvedValue(true) };

    const service = new OrdersService(
      orderModel as never,
      {} as never,
      {} as never,
      {} as never,
      pubSub as never,
      usersService as never,
      {} as never,
      {} as never,
      trackingService as never,
      {} as never,
      {} as never,
      notificationsService as never,
      {} as never,
      loyaltyService as never,
      couponsService as never,
      customerWalletService as never,
      { get: () => 'UTC' } as never,
      {} as never,
    );
    return { service, orderModel, customerWalletService, usersService, notificationsService };
  };

  it('abortOrder refunds a captured FLOUCI (online) payment to the customer wallet', async () => {
    const order = baseOrder({ orderStatus: 'PENDING' });
    const { service, customerWalletService, orderModel } = buildService(order);

    await service.abortOrder('user_clerk_1', String(order._id));

    expect(customerWalletService.credit).toHaveBeenCalledWith(
      'user_clerk_1',
      42.5,
      expect.objectContaining({ reason: 'REFUND_CUSTOMER_CANCELLED' }),
    );
    const refundUpdateCall = orderModel.findByIdAndUpdate.mock.calls.find(
      (call: any[]) => call[1]?.$set?.paymentStatus === 'REFUNDED',
    );
    expect(refundUpdateCall).toBeDefined();
  });

  it('abortOrder still refunds a captured WALLET payment (no regression)', async () => {
    const order = baseOrder({ orderStatus: 'PENDING', paymentMethod: 'WALLET' });
    const { service, customerWalletService } = buildService(order);

    await service.abortOrder('user_clerk_1', String(order._id));

    expect(customerWalletService.credit).toHaveBeenCalledWith(
      'user_clerk_1',
      42.5,
      expect.objectContaining({ reason: 'REFUND_CUSTOMER_CANCELLED' }),
    );
  });

  it('abortOrder does not attempt a refund for an unpaid COD order', async () => {
    const order = baseOrder({
      orderStatus: 'PENDING',
      paymentMethod: 'COD',
      paymentStatus: 'UNPAID',
    });
    const { service, customerWalletService } = buildService(order);

    await service.abortOrder('user_clerk_1', String(order._id));

    expect(customerWalletService.credit).not.toHaveBeenCalled();
  });

  describe('updateDeliveryAddress', () => {
    it('updates the address while the order is still PENDING', async () => {
      const order = baseOrder({ orderStatus: 'PENDING' });
      const { service, orderModel } = buildService(order);

      await service.updateDeliveryAddress('user_clerk_1', String(order._id), {
        label: 'Home',
        deliveryAddress: '12 Rue de la Paix',
        details: 'Ring the bell twice',
        coordinates: [10.18, 36.8],
      });

      const updateCall = orderModel.findByIdAndUpdate.mock.calls[0];
      expect(updateCall[1].$set).toEqual(
        expect.objectContaining({
          'deliveryAddress.label': 'Home',
          'deliveryAddress.deliveryAddress': '12 Rue de la Paix',
          'deliveryAddress.details': 'Ring the bell twice',
          'deliveryAddress.location': { type: 'Point', coordinates: [10.18, 36.8] },
        }),
      );
    });

    it('allows the address to be changed while ACCEPTED (still pre-preparation)', async () => {
      const order = baseOrder({ orderStatus: 'ACCEPTED' });
      const { service } = buildService(order);

      await expect(
        service.updateDeliveryAddress('user_clerk_1', String(order._id), {
          deliveryAddress: 'New address',
        }),
      ).resolves.toBeDefined();
    });

    it('rejects an address change once the order is PREPARED', async () => {
      const order = baseOrder({ orderStatus: 'PREPARED' });
      const { service } = buildService(order);

      await expect(
        service.updateDeliveryAddress('user_clerk_1', String(order._id), {
          deliveryAddress: 'New address',
        }),
      ).rejects.toThrow('Delivery address can only be changed before the restaurant starts preparing the order');
    });

    it('rejects an address change from a caller who does not own the order', async () => {
      const order = baseOrder({ orderStatus: 'PENDING' });
      const { service, usersService } = buildService(order);
      usersService.resolveMongoIdByClerkId.mockResolvedValue(new Types.ObjectId());

      await expect(
        service.updateDeliveryAddress('someone_else', String(order._id), {
          deliveryAddress: 'New address',
        }),
      ).rejects.toThrow('Not your order');
    });
  });

  it('cancelOrder (store-initiated) refunds a captured FLOUCI payment', async () => {
    const order = baseOrder({ orderStatus: 'ACCEPTED' });
    const { service, customerWalletService } = buildService(order);

    await service.cancelOrder(String(order._id), String(order.restaurant), 'out of stock');

    expect(customerWalletService.credit).toHaveBeenCalledWith(
      'user_clerk_1',
      42.5,
      expect.objectContaining({ reason: 'REFUND_RESTAURANT_CANCELLED' }),
    );
  });

  it('cancelOrder does not refund an unpaid COD order', async () => {
    const order = baseOrder({
      orderStatus: 'ACCEPTED',
      paymentMethod: 'COD',
      paymentStatus: 'UNPAID',
    });
    const { service, customerWalletService } = buildService(order);

    await service.cancelOrder(String(order._id), String(order.restaurant), 'out of stock');

    expect(customerWalletService.credit).not.toHaveBeenCalled();
  });

  // Regression: the coverage audit found a customer was never told a
  // restaurant cancelled their order via push — only the in-app GraphQL
  // subscription, invisible when the app is backgrounded/closed, which is
  // exactly when this matters most.
  it('cancelOrder pushes an ORDER_CANCELLED notification to the customer', async () => {
    const order = baseOrder({ orderStatus: 'ACCEPTED' });
    const { service, notificationsService } = buildService(order);

    await service.cancelOrder(String(order._id), String(order.restaurant), 'out of stock');

    expect(notificationsService.sendPushToUser).toHaveBeenCalledWith(
      'user_clerk_1',
      'CUSTOMER',
      expect.stringContaining('cancelled'),
      expect.any(String),
      expect.objectContaining({ type: 'ORDER_CANCELLED', orderId: String(order._id) }),
    );
  });

  it('cancelOrder does not push a notification when the order has no customer clerkId', async () => {
    const order = baseOrder({ orderStatus: 'ACCEPTED', user: { ...user, clerkId: undefined } });
    const { service, notificationsService } = buildService(order);

    await service.cancelOrder(String(order._id), String(order.restaurant), 'out of stock');

    expect(notificationsService.sendPushToUser).not.toHaveBeenCalled();
  });

  it('updateStatus (admin force-cancel) refunds a captured FLOUCI payment', async () => {
    const order = baseOrder({ orderStatus: 'ACCEPTED' });
    const { service, customerWalletService } = buildService(order);

    await service.updateStatus(String(order._id), 'CANCELLED');

    expect(customerWalletService.credit).toHaveBeenCalledWith(
      'user_clerk_1',
      42.5,
      expect.objectContaining({ reason: 'REFUND_ADMIN_CANCELLED' }),
    );
  });

  it('updateStatus (admin force CANCELLEDBYREST) also refunds a captured FLOUCI payment', async () => {
    const order = baseOrder({ orderStatus: 'ACCEPTED' });
    const { service, customerWalletService } = buildService(order);

    await service.updateStatus(String(order._id), 'CANCELLEDBYREST');

    expect(customerWalletService.credit).toHaveBeenCalledWith(
      'user_clerk_1',
      42.5,
      expect.objectContaining({ reason: 'REFUND_ADMIN_CANCELLED' }),
    );
  });
});

// Go-live UX audit: enatega-multivendor-web's placeOrder call had no
// Idempotency-Key handling on either side, so a reconnect-triggered retry
// (or an accidental double-submit) could place — and charge — the same
// order twice. The short-circuit must fire before ANY side effect (catalog
// read, coupon claim, wallet debit), so this only needs to prove it returns
// early without ever calling restaurantsService.
describe('OrdersService placeOrder — idempotency key short-circuit', () => {
  it('returns the existing order without doing any placement work when the key was already used', async () => {
    const existingOrder = { _id: new Types.ObjectId() };
    const orderModel = {
      findOne: jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(existingOrder) }),
      }),
    };
    const restaurantsService = { findOrderPlacementProfile: jest.fn() };
    const service = new OrdersService(
      orderModel as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      restaurantsService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { get: () => 'UTC' } as never,
      {} as never,
    );
    jest.spyOn(service as any, 'findOrderOrThrow').mockResolvedValue(existingOrder);

    const result = await service.placeOrder(
      'user_clerk_1',
      String(new Types.ObjectId()),
      [],
      'COD',
      0,
      0,
      { deliveryAddress: 'x' } as never,
      new Date().toISOString(),
      false,
      0,
      undefined,
      undefined,
      0,
      false,
      'retry-key-123',
    );

    expect(orderModel.findOne).toHaveBeenCalledWith({
      placementIdempotencyKey: 'retry-key-123',
    });
    expect(restaurantsService.findOrderPlacementProfile).not.toHaveBeenCalled();
    expect(result).toBe(existingOrder);
  });
});

// Go-live UX audit: with no cost to declining an assignment, a rider could
// cherry-pick only the best orders forever. These counters are the raw
// material for a dispatch-quality signal — this suite only asserts the
// counters are actually recorded on the two outcome paths.
describe('OrdersService — rider assignment outcome tracking', () => {
  const chain = (resolved: unknown) => {
    const q: any = {};
    q.populate = jest.fn(() => q);
    q.select = jest.fn(() => q);
    q.lean = jest.fn(() => q);
    q.exec = jest.fn().mockResolvedValue(resolved);
    return q;
  };

  const riderId = new Types.ObjectId();

  const buildService = (order: Record<string, unknown>) => {
    const orderModel = {
      findById: jest.fn().mockReturnValue(chain(order)),
      findByIdAndUpdate: jest.fn().mockReturnValue(chain(order)),
      findOneAndUpdate: jest.fn().mockReturnValue(chain(order)),
    };
    const ridersService = { recordAssignmentOutcome: jest.fn().mockResolvedValue(undefined) };
    const pubSub = { publish: jest.fn().mockResolvedValue(undefined) };
    const trackingService = { terminateOrderTracking: jest.fn().mockResolvedValue(undefined) };

    const service = new OrdersService(
      orderModel as never,
      {} as never,
      {} as never,
      {} as never,
      pubSub as never,
      {} as never,
      {} as never,
      ridersService as never,
      trackingService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { get: () => 'UTC' } as never,
      {} as never,
    );
    return { service, ridersService };
  };

  it('records a rejection when a rider declines an already-assigned order', async () => {
    const order = {
      _id: new Types.ObjectId(),
      rider: riderId,
      orderStatus: 'ASSIGNED',
    };
    const { service, ridersService } = buildService(order);

    await service.rejectRiderAssignment(String(riderId), String(order._id));

    expect(ridersService.recordAssignmentOutcome).toHaveBeenCalledWith(String(riderId), 'rejected');
  });

  it('records an acceptance when a rider successfully claims an order', async () => {
    const order = {
      _id: new Types.ObjectId(),
      rider: riderId,
      orderStatus: 'ASSIGNED',
      zone: null,
      restaurant: new Types.ObjectId(),
    };
    const { service, ridersService } = buildService(order);

    await service.assignOrder(String(riderId), String(order._id));

    expect(ridersService.recordAssignmentOutcome).toHaveBeenCalledWith(String(riderId), 'accepted');
  });
});

describe('OrdersService — operationsFeed publish (pushStatusHistory side-channel)', () => {
  const chain = (resolved: unknown) => {
    const q: any = {};
    q.populate = jest.fn(() => q);
    q.lean = jest.fn(() => q);
    q.exec = jest.fn().mockResolvedValue(resolved);
    return q;
  };

  const buildService = (orderModel: Record<string, unknown>, pubSub: Record<string, unknown>) =>
    new OrdersService(
      orderModel as never,
      {} as never,
      {} as never,
      {} as never,
      pubSub as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { get: () => 'UTC' } as never,
      {} as never,
    );

  it('publishes an enriched OPERATIONS_FEED_ITEM after appending statusHistory', async () => {
    const orderId = String(new Types.ObjectId());
    const orderModel = {
      findByIdAndUpdate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(undefined) }),
      findById: jest.fn().mockReturnValue(
        chain({
          orderId: 'ORD-123',
          rider: { _id: 'r1', name: 'Ali' },
          restaurant: { _id: 'rest1', name: 'Le Bistro' },
        }),
      ),
    };
    const pubSub = { publish: jest.fn().mockResolvedValue(undefined) };
    const service = buildService(orderModel, pubSub);

    await (service as any).pushStatusHistory(orderId, 'PICKED', 'RIDER', 'rider-id-1');
    // publishOperationsFeedItem is fire-and-forget (.catch) inside
    // pushStatusHistory — flush the microtask queue before asserting.
    await new Promise((resolve) => setImmediate(resolve));

    expect(pubSub.publish).toHaveBeenCalledWith(Events.OPERATIONS_FEED_ITEM, {
      [Events.OPERATIONS_FEED_ITEM]: expect.objectContaining({
        orderId,
        orderDisplayId: 'ORD-123',
        status: 'PICKED',
        actor: 'RIDER',
        actorId: 'rider-id-1',
        riderName: 'Ali',
        restaurantName: 'Le Bistro',
      }),
    });
  });

  it('never blocks/throws when the enrichment read or publish fails', async () => {
    const orderId = String(new Types.ObjectId());
    const orderModel = {
      findByIdAndUpdate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(undefined) }),
      findById: jest.fn().mockImplementation(() => {
        throw new Error('boom');
      }),
    };
    const pubSub = { publish: jest.fn() };
    const service = buildService(orderModel, pubSub);

    await expect(
      (service as any).pushStatusHistory(orderId, 'PICKED', 'RIDER', 'rider-id-1'),
    ).resolves.toBeUndefined();
  });
});

// ARRIVED status: rider-facing "I'm here" step inserted between PICKED and
// DELIVERED, mirroring Glovo/Uber Eats/DoorDash. Covers the transition guard,
// the requireArrivedStep gate on DELIVERED, the customer push notification,
// and the GPS proximity check.
describe('OrdersService — ARRIVED status', () => {
  const riderId = new Types.ObjectId();
  const orderId = new Types.ObjectId();

  const chain = (resolved: unknown) => {
    const q: any = {};
    q.populate = jest.fn(() => q);
    q.select = jest.fn(() => q);
    q.lean = jest.fn(() => q);
    q.exec = jest.fn().mockResolvedValue(resolved);
    return q;
  };

  const buildService = (
    order: Record<string, unknown>,
    opts: {
      requireArrivedStep?: boolean;
      enforceArrivalGps?: boolean;
      arrivalGpsRadiusMeters?: number;
      riderLocation?: { latitude: number; longitude: number } | null;
    } = {},
  ) => {
    const orderModel = {
      findById: jest.fn().mockReturnValue(chain(order)),
      findByIdAndUpdate: jest.fn().mockReturnValue(chain(order)),
      findOneAndUpdate: jest.fn().mockReturnValue(chain(order)),
    };
    const configurationModel = {
      findOne: jest.fn().mockReturnValue(
        chain({
          requireArrivedStep: opts.requireArrivedStep ?? true,
          enforceArrivalGps: opts.enforceArrivalGps ?? false,
          arrivalGpsRadiusMeters: opts.arrivalGpsRadiusMeters ?? 100,
        }),
      ),
    };
    const pubSub = { publish: jest.fn().mockResolvedValue(undefined) };
    const trackingService = {
      terminateOrderTracking: jest.fn().mockResolvedValue(undefined),
      getLatestLocationForOrder: jest
        .fn()
        .mockResolvedValue(opts.riderLocation === undefined ? null : opts.riderLocation),
    };
    const notificationsService = { sendPushToUser: jest.fn().mockResolvedValue(true) };

    const service = new OrdersService(
      orderModel as never,
      {} as never,
      {} as never,
      configurationModel as never,
      pubSub as never,
      {} as never,
      {} as never,
      {} as never,
      trackingService as never,
      {} as never,
      {} as never,
      notificationsService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { get: () => 'UTC' } as never,
      {} as never,
    );
    return { service, orderModel, configurationModel, trackingService, notificationsService, pubSub };
  };

  it('allows the assigned rider to mark a PICKED order as ARRIVED', async () => {
    const order = {
      _id: orderId,
      rider: riderId,
      orderStatus: 'PICKED',
      user: { clerkId: 'clerk_customer_1' },
    };
    const { service, orderModel, notificationsService } = buildService(order);

    await service.updateOrderStatusRider(String(orderId), String(riderId), 'ARRIVED');

    expect(orderModel.findByIdAndUpdate).toHaveBeenCalledWith(
      String(orderId),
      { $set: expect.objectContaining({ orderStatus: 'ARRIVED', arrivedAt: expect.any(String) }) },
      { new: true },
    );
    expect(notificationsService.sendPushToUser).toHaveBeenCalledWith(
      'clerk_customer_1',
      'CUSTOMER',
      expect.stringContaining('arrivé'),
      expect.stringContaining('Merci de rejoindre'),
      { type: 'ORDER_ARRIVED', orderId: String(orderId) },
    );
  });

  it('rejects ARRIVED when the order has not been picked up yet', async () => {
    const order = { _id: orderId, rider: riderId, orderStatus: 'ASSIGNED' };
    const { service } = buildService(order);

    await expect(
      service.updateOrderStatusRider(String(orderId), String(riderId), 'ARRIVED'),
    ).rejects.toThrow('Order must be picked up before it can be marked arrived');
  });

  it('rejects DELIVERED from PICKED when requireArrivedStep is enabled (default)', async () => {
    const order = { _id: orderId, rider: riderId, orderStatus: 'PICKED', paymentMethod: 'CARD' };
    const { service } = buildService(order, { requireArrivedStep: true });

    await expect(
      service.updateOrderStatusRider(String(orderId), String(riderId), 'DELIVERED'),
    ).rejects.toThrow('Order must be marked arrived before it can be delivered');
  });

  it('allows DELIVERED from PICKED when requireArrivedStep is disabled', async () => {
    const order = { _id: orderId, rider: riderId, orderStatus: 'PICKED', paymentMethod: 'CARD' };
    const { service, orderModel } = buildService(order, { requireArrivedStep: false });
    jest.spyOn(service as any, 'finalizeDeliveryIfBothConfirmed').mockResolvedValue(undefined);

    await service.updateOrderStatusRider(String(orderId), String(riderId), 'DELIVERED');

    expect(orderModel.findByIdAndUpdate).toHaveBeenCalledWith(
      String(orderId),
      { $set: expect.objectContaining({ riderDeliveredAt: expect.any(String) }) },
      { new: true },
    );
  });

  it('allows DELIVERED from ARRIVED regardless of requireArrivedStep', async () => {
    const order = { _id: orderId, rider: riderId, orderStatus: 'ARRIVED', paymentMethod: 'CARD' };
    const { service } = buildService(order, { requireArrivedStep: true });
    const finalize = jest
      .spyOn(service as any, 'finalizeDeliveryIfBothConfirmed')
      .mockResolvedValue(undefined);

    await service.updateOrderStatusRider(String(orderId), String(riderId), 'DELIVERED');

    expect(finalize).toHaveBeenCalledWith(String(orderId));
  });

  it('rejects a rider who does not own the order', async () => {
    const order = { _id: orderId, rider: new Types.ObjectId(), orderStatus: 'PICKED' };
    const { service } = buildService(order);

    await expect(
      service.updateOrderStatusRider(String(orderId), String(riderId), 'ARRIVED'),
    ).rejects.toThrow('Order is not assigned to you');
  });

  it('blocks ARRIVED when the GPS check is enforced and the rider is too far away', async () => {
    const order = {
      _id: orderId,
      rider: riderId,
      orderStatus: 'PICKED',
      user: { clerkId: 'clerk_customer_1' },
      deliveryAddress: { location: { type: 'Point', coordinates: [10.0, 36.8] } },
    };
    const { service } = buildService(order, {
      enforceArrivalGps: true,
      arrivalGpsRadiusMeters: 100,
      // ~11km away from the delivery address — well outside the 100m radius.
      riderLocation: { latitude: 36.9, longitude: 10.0 },
    });

    await expect(
      service.updateOrderStatusRider(String(orderId), String(riderId), 'ARRIVED'),
    ).rejects.toThrow(/within 100m/);
  });

  it('allows ARRIVED when the GPS check is enforced and the rider is within range', async () => {
    const order = {
      _id: orderId,
      rider: riderId,
      orderStatus: 'PICKED',
      user: { clerkId: 'clerk_customer_1' },
      deliveryAddress: { location: { type: 'Point', coordinates: [10.0, 36.8] } },
    };
    const { service, orderModel } = buildService(order, {
      enforceArrivalGps: true,
      arrivalGpsRadiusMeters: 100,
      riderLocation: { latitude: 36.8001, longitude: 10.0001 },
    });

    await service.updateOrderStatusRider(String(orderId), String(riderId), 'ARRIVED');

    expect(orderModel.findByIdAndUpdate).toHaveBeenCalledWith(
      String(orderId),
      expect.objectContaining({
        $set: expect.objectContaining({ orderStatus: 'ARRIVED' }),
      }),
      { new: true },
    );
  });

  it('skips the GPS check when the rider has no recent live location on file', async () => {
    const order = {
      _id: orderId,
      rider: riderId,
      orderStatus: 'PICKED',
      user: { clerkId: 'clerk_customer_1' },
      deliveryAddress: { location: { type: 'Point', coordinates: [10.0, 36.8] } },
    };
    const { service, orderModel } = buildService(order, {
      enforceArrivalGps: true,
      riderLocation: null,
    });

    await service.updateOrderStatusRider(String(orderId), String(riderId), 'ARRIVED');

    expect(orderModel.findByIdAndUpdate).toHaveBeenCalledWith(
      String(orderId),
      expect.objectContaining({ $set: expect.objectContaining({ orderStatus: 'ARRIVED' }) }),
      { new: true },
    );
  });

  it('does not enforce GPS proximity when enforceArrivalGps is disabled', async () => {
    const order = {
      _id: orderId,
      rider: riderId,
      orderStatus: 'PICKED',
      user: { clerkId: 'clerk_customer_1' },
      deliveryAddress: { location: { type: 'Point', coordinates: [10.0, 36.8] } },
    };
    const { service, orderModel } = buildService(order, {
      enforceArrivalGps: false,
      riderLocation: { latitude: 40.0, longitude: -70.0 },
    });

    await service.updateOrderStatusRider(String(orderId), String(riderId), 'ARRIVED');

    expect(orderModel.findByIdAndUpdate).toHaveBeenCalledWith(
      String(orderId),
      expect.objectContaining({ $set: expect.objectContaining({ orderStatus: 'ARRIVED' }) }),
      { new: true },
    );
  });
});
