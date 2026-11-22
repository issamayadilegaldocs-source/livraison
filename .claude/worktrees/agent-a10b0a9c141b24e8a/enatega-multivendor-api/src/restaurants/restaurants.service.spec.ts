import { ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Types } from 'mongoose';
import { RestaurantsService } from './restaurants.service';
import { RestaurantProfileService } from './restaurant-profile.service';
import { RestaurantLookupService } from './restaurant-lookup.service';
import { RestaurantWalletService } from './restaurant-wallet.service';
import { RestaurantZonesService } from './restaurant-zones.service';

/** Builds a thenable query stub whose chained methods all return itself. */
const query = (resolved: unknown) => {
  const q: any = {};
  for (const m of ['findById', 'findOne', 'findByIdAndUpdate', 'populate', 'select', 'lean']) {
    q[m] = jest.fn().mockReturnValue(q);
  }
  q.exec = jest.fn().mockResolvedValue(resolved);
  return q;
};

const VALID_ID = '65a4d4b5e95f1a07a5a3d111';
const profileDeps = (restaurantModel: any) =>
  [
    restaurantModel,
    {} as never,
    {} as never,
    { getOrThrow: () => 'sk_test', get: () => undefined } as never,
    { timezoneFor: jest.fn().mockResolvedValue(null) } as never,
  ] as const;

describe('RestaurantsService — per-store Clerk identity', () => {
  const makeService = (restaurantModel: any) =>
    new RestaurantProfileService(...profileDeps(restaurantModel));

  it('rejects reusing an ADMIN/VENDOR Clerk account as a store login', async () => {
    const restaurantModel: any = {};
    const service = makeService(restaurantModel);
    jest.spyOn(service as any, 'clerk').mockReturnValue({
      users: {
        createUser: jest.fn().mockRejectedValue({ status: 422 }),
        getUserList: jest
          .fn()
          .mockResolvedValue({ data: [{ id: 'user_admin', publicMetadata: { role: 'ADMIN' } }] }),
        updateUserMetadata: jest.fn(),
      },
    });

    await expect(
      service.create(
        { name: 'R', username: 'admin@x.com', password: 'pw', location: { coordinates: [10, 34] } } as any,
        VALID_ID,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects binding a Clerk identity already linked to another restaurant', async () => {
    const restaurantModel: any = {
      // The linked-restaurant guard query resolves to a different restaurant.
      findOne: jest.fn().mockReturnValue(query({ _id: 'other' })),
    };
    const service = makeService(restaurantModel);
    jest.spyOn(service as any, 'clerk').mockReturnValue({
      users: {
        createUser: jest.fn().mockRejectedValue({ status: 422 }),
        getUserList: jest
          .fn()
          .mockResolvedValue({ data: [{ id: 'user_dup', publicMetadata: {} }] }),
        updateUserMetadata: jest.fn(),
      },
    });

    await expect(
      service.create(
        { name: 'R', username: 'dup@x.com', password: 'pw', location: { coordinates: [10, 34] } } as any,
        VALID_ID,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('aborts the edit (and never persists the username) when the Clerk email sync fails', async () => {
    const findByIdAndUpdate = jest.fn().mockReturnValue(query({ _id: VALID_ID }));
    const restaurantModel: any = {
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: VALID_ID,
          username: 'old@x.com',
          clerkId: 'user_1',
          name: 'R',
        }),
      }),
      findByIdAndUpdate,
    };
    const service = makeService(restaurantModel);
    jest.spyOn(service as any, 'clerk').mockReturnValue({
      users: { updateUser: jest.fn() },
      emailAddresses: {
        createEmailAddress: jest.fn().mockRejectedValue(new Error('clerk down')),
        deleteEmailAddress: jest.fn(),
      },
    });

    await expect(
      service.edit({ _id: VALID_ID, username: 'new@x.com' } as any),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    // The desynced username must NOT have been written to Mongo.
    expect(findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('backfills a Clerk identity for a legacy restaurant on its next password edit', async () => {
    const findByIdAndUpdate = jest
      .fn()
      .mockReturnValue(query({ _id: VALID_ID, clerkId: 'user_new' }));
    const restaurantModel: any = {
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: VALID_ID,
          username: 'legacy@x.com',
          clerkId: undefined,
          name: 'R',
        }),
      }),
      findByIdAndUpdate,
    };
    const service = makeService(restaurantModel);
    jest.spyOn(service as any, 'clerk').mockReturnValue({
      users: { createUser: jest.fn().mockResolvedValue({ id: 'user_new' }) },
    });

    await service.edit({ _id: VALID_ID, password: 'newpw' } as any);

    const [, update] = findByIdAndUpdate.mock.calls[0];
    expect(update.$set.clerkId).toBe('user_new');
    // Password is never persisted to Mongo.
    expect(update.$set.password).toBeUndefined();
  });

  it('does not resolve a deactivated restaurant for store login', async () => {
    const findOne = jest.fn().mockReturnValue(query(null));
    const service = new RestaurantLookupService({ findOne } as never, {} as never);

    await expect(service.findByClerkIdOrThrow('user_1')).rejects.toBeInstanceOf(NotFoundException);
    // The lookup must exclude inactive restaurants.
    expect(findOne).toHaveBeenCalledWith(
      expect.objectContaining({ clerkId: 'user_1', isActive: { $ne: false } }),
    );
  });

  it('clears stale delivery bounds when saving a point-only delivery zone', async () => {
    const findByIdAndUpdate = jest.fn().mockReturnValue(query({ _id: VALID_ID }));
    const service = makeService({ findByIdAndUpdate });

    await service.updateDeliveryBoundsAndLocation(
      VALID_ID,
      'point',
      { coordinates: [10.76314888831944, 34.81128560235277] },
      {
        coordinates: [
          [
            [10.76314888831944, 34.81128560235277],
            [10.76314888831944, 34.81128560235277],
          ],
        ],
      },
      { radius: 1000 },
    );

    expect(findByIdAndUpdate).toHaveBeenCalledWith(
      VALID_ID,
      expect.objectContaining({
        $set: expect.objectContaining({
          boundType: 'point',
          location: {
            type: 'Point',
            coordinates: [10.76314888831944, 34.81128560235277],
          },
        }),
        $unset: { deliveryBounds: '', circleBounds: '', zone: '' },
      }),
      { new: true },
    );
  });

  it('normalizes a valid delivery polygon before saving it', async () => {
    const findByIdAndUpdate = jest.fn().mockReturnValue(query({ _id: VALID_ID }));
    const service = makeService({ findByIdAndUpdate });

    await service.updateDeliveryBoundsAndLocation(
      VALID_ID,
      'polygon',
      { coordinates: [10, 34] },
      {
        coordinates: [
          [
            [10, 34],
            [11, 34],
            [11, 35],
          ],
        ],
      },
    );

    const [, update] = findByIdAndUpdate.mock.calls[0];
    expect(update.$set.deliveryBounds).toEqual({
      type: 'Polygon',
      coordinates: [
        [
          [10, 34],
          [11, 34],
          [11, 35],
          [10, 34],
        ],
      ],
    });
  });
});

describe('RestaurantsService.delete — active toggle', () => {
  const chain = (resolved: unknown) => ({
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(resolved),
  });

  const makeService = (restaurantModel: any) =>
    new RestaurantProfileService(...profileDeps(restaurantModel));

  // The admin "active" switch maps to this mutation. It used to force
  // `isActive: false`, which made deactivation one-way; it must now flip both
  // directions so a store can be reactivated.
  it.each([
    [true, false],
    [false, true],
  ])('flips isActive %s -> %s instead of forcing deactivation', async (current, next) => {
    const findByIdAndUpdate = jest
      .fn()
      .mockReturnValue(chain({ _id: VALID_ID, isActive: next }));
    const restaurantModel: any = {
      findById: jest.fn().mockReturnValue(chain({ _id: VALID_ID, isActive: current })),
      findByIdAndUpdate,
    };
    const service = makeService(restaurantModel);

    const result = await service.delete(VALID_ID);

    const [, update] = findByIdAndUpdate.mock.calls[0];
    expect(update.$set.isActive).toBe(next);
    expect((result as any).isActive).toBe(next);
  });

  it('throws NotFoundException and does not write when the store is missing', async () => {
    const findByIdAndUpdate = jest.fn();
    const restaurantModel: any = {
      findById: jest.fn().mockReturnValue(chain(null)),
      findByIdAndUpdate,
    };
    const service = makeService(restaurantModel);

    await expect(service.delete(VALID_ID)).rejects.toBeInstanceOf(NotFoundException);
    expect(findByIdAndUpdate).not.toHaveBeenCalled();
  });
});

describe('RestaurantsService order-facing ports', () => {
  const makeService = (restaurantModel: any) => {
    // Same mock plays ownerModel too: existing cases either short-circuit
    // before it's touched, or its `findOne` returning null is exactly the
    // "no owner-level restaurant either" case they're testing.
    const lookup = new RestaurantLookupService(restaurantModel, restaurantModel);
    const wallet = new RestaurantWalletService(restaurantModel);
    const zones = new RestaurantZonesService(restaurantModel, restaurantModel);
    return new RestaurantsService(
      lookup,
      wallet,
      zones,
      {} as never,
      {} as never,
      {} as never,
    );
  };

  it('resolves a restaurant Mongo id from Clerk id', async () => {
    const id = new Types.ObjectId();
    const findOne = jest.fn().mockReturnValue(query({ _id: id }));
    const service = makeService({ findOne });

    await expect(service.resolveMongoIdByClerkId('store_1')).resolves.toBe(String(id));
    expect(findOne).toHaveBeenCalledWith({ clerkId: 'store_1' }, '_id');
  });

  it('throws when a store Clerk id is not linked', async () => {
    const service = makeService({ findOne: jest.fn().mockReturnValue(query(null)) });

    await expect(service.resolveMongoIdByClerkId('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it.each([
    [undefined, 0.1],
    [-0.5, 0],
    [0.25, 0.25],
    [1.5, 1],
  ])('returns a clamped commission rate for %s', async (storedRate, expectedRate) => {
    const findById = jest.fn().mockReturnValue(query({ commissionRate: storedRate }));
    const service = makeService({ findById });

    await expect(service.getCommissionRate(VALID_ID)).resolves.toBe(expectedRate);
    expect(findById).toHaveBeenCalledWith(VALID_ID, 'commissionRate');
  });

  it('returns store wallet context for withdraw checks', async () => {
    const id = new Types.ObjectId();
    const findOne = jest.fn().mockReturnValue(query({ _id: id, currentWalletAmount: 42, currentWalletAmountMinor: 4200 }));
    const service = makeService({ findOne });

    await expect(service.getWalletContext('store_1')).resolves.toEqual({
      id: String(id),
      currentWalletAmount: 42,
      currentWalletAmountMinor: 4200,
    });
    expect(findOne).toHaveBeenCalledWith({ clerkId: 'store_1' }, '_id currentWalletAmount currentWalletAmountMinor');
  });

  it('returns null store wallet context when no store is linked', async () => {
    const service = makeService({ findOne: jest.fn().mockReturnValue(query(null)) });

    await expect(service.getWalletContext('missing')).resolves.toBeNull();
  });

  it('debits store wallet withdrawals with minor-unit deltas', async () => {
    const findByIdAndUpdate = jest.fn().mockResolvedValue(null);
    const service = makeService({ findByIdAndUpdate });

    await service.debitWalletForWithdrawal(VALID_ID, 25, 25000, { currency: 'TND', scale: 3 });

    expect(findByIdAndUpdate).toHaveBeenCalledWith(
      VALID_ID,
      expect.arrayContaining([
        expect.objectContaining({
          $set: expect.objectContaining({
            currentWalletAmountMinor: expect.objectContaining({
              $add: expect.arrayContaining([-25000]),
            }),
            withdrawnWalletAmountMinor: expect.objectContaining({
              $add: expect.arrayContaining([25000]),
            }),
            walletAmountCurrency: 'TND',
            walletAmountScale: 3,
          }),
        }),
      ]),
    );
  });

  it('loads only checkout placement fields (catalog now lives in its own collections)', async () => {
    const restaurant = { _id: VALID_ID };
    const findById = jest.fn().mockReturnValue(query(restaurant));
    const service = makeService({ findById });

    await expect(service.findOrderPlacementProfile(VALID_ID)).resolves.toBe(restaurant);
    // Catalog (categories/addons/options) is no longer embedded, so the
    // placement profile must not project it.
    expect(findById).not.toHaveBeenCalledWith(VALID_ID, expect.stringContaining('categories'));
    expect(findById).toHaveBeenCalledWith(
      VALID_ID,
      expect.stringContaining('deliveryBounds'),
    );
  });

  it('increments and returns the restaurant order counter', async () => {
    const findByIdAndUpdate = jest.fn().mockReturnValue(query({ orderId: 12 }));
    const service = makeService({ findByIdAndUpdate });

    await expect(service.incrementOrderCounter(VALID_ID)).resolves.toBe(12);
    expect(findByIdAndUpdate).toHaveBeenCalledWith(
      VALID_ID,
      { $inc: { orderId: 1 } },
      { new: true },
    );
  });

  it('returns a boolean for delivery bounds membership', async () => {
    const findOne = jest.fn().mockReturnValue(query({ _id: VALID_ID }));
    const service = makeService({ findOne });

    await expect(service.isAddressInDeliveryBounds(VALID_ID, [10, 34])).resolves.toBe(true);
    expect(findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: expect.any(Types.ObjectId),
        deliveryBounds: expect.any(Object),
      }),
    );
  });

  it('loads only scheduler open-status fields', async () => {
    const status = { isActive: true, isAvailable: true, openingTimes: [], timezone: 'UTC' };
    const findById = jest.fn().mockReturnValue(query(status));
    const service = makeService({ findById });

    await expect(service.findOrderOpenStatusInputs(VALID_ID)).resolves.toBe(status);
    expect(findById).toHaveBeenCalledWith(
      VALID_ID,
      'openingTimes isAvailable isActive timezone',
    );
  });
});
