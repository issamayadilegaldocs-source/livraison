import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { TrackingConfig } from './tracking.config';

const testConfig: TrackingConfig = {
  sessionTtlSeconds: 43_200,
  locationTtlSeconds: 600,
  presenceTtlSeconds: 300,
  dispatchFallbackStaleSeconds: 600,
  rateLimitMax: 30,
  rateLimitWindowSeconds: 60,
  futureToleranceMs: 120_000,
};

describe('TrackingService', () => {
  it('requires a scoped rider tracking token for location ingestion', async () => {
    const service = new TrackingService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      testConfig,
      {} as never,
    );
    await expect(
      service.updateLocation(undefined, 'order-id', {
        latitude: 52.52,
        longitude: 13.405,
        capturedAt: new Date(),
        updateId: '694c4e52-72f1-4b0c-b6f2-88ac61732cf3',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('publishes an accepted PICKED location only to its order channel', async () => {
    const orderId = '65a4d4b5e95f1a07a5a3d111';
    const riderId = '65a4d4b5e95f1a07a5a3d222';
    const session = {
      sessionId: 'session-1',
      orderId,
      riderId,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    const redis = {
      get: jest.fn().mockResolvedValue(JSON.stringify(session)),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      eval: jest
        .fn()
        .mockImplementation((_script, _keys, _key, capturedAt, updateId, payload) =>
          Promise.resolve([1, payload ?? JSON.stringify({ capturedAt, updateId })]),
        ),
    };
    const pubSub = { publish: jest.fn().mockResolvedValue(undefined) };
    const orderModel = {
      findOne: jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve({ _id: orderId, orderStatus: 'PICKED' }) }),
      }),
    };
    const service = new TrackingService(
      redis as never,
      pubSub as never,
      orderModel as never,
      {} as never,
      {} as never,
      {} as never,
      testConfig,
      {} as never,
    );
    const capturedAt = new Date();

    await service.updateLocation('scoped-token', orderId, {
      latitude: 52.52,
      longitude: 13.405,
      capturedAt,
      updateId: '694c4e52-72f1-4b0c-b6f2-88ac61732cf3',
    });

    expect(pubSub.publish).toHaveBeenCalledWith(
      `tracking:order:${orderId}:events`,
      expect.objectContaining({ orderRiderLocationUpdated: expect.objectContaining({ orderId }) }),
    );
  });

  it('flushes buffered intermediate points and the live point in one chronological trail write', async () => {
    const orderId = '65a4d4b5e95f1a07a5a3d111';
    const riderId = '65a4d4b5e95f1a07a5a3d222';
    const session = {
      sessionId: 'session-1',
      orderId,
      riderId,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    const redis = {
      get: jest.fn().mockResolvedValue(JSON.stringify(session)),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      eval: jest
        .fn()
        .mockImplementation((_script, _keys, _key, _capturedAt, _updateId, payload) =>
          Promise.resolve([1, payload]),
        ),
    };
    const pubSub = { publish: jest.fn().mockResolvedValue(undefined) };
    const orderModel = {
      findOne: jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve({ _id: orderId, orderStatus: 'PICKED' }) }),
      }),
    };
    const trailExec = jest.fn().mockResolvedValue({});
    const orderTrailModel = { updateOne: jest.fn().mockReturnValue({ exec: trailExec }) };
    const service = new TrackingService(
      redis as never,
      pubSub as never,
      orderModel as never,
      {} as never,
      {} as never,
      orderTrailModel as never,
      testConfig,
      {} as never,
    );

    const liveCapturedAt = new Date('2026-06-28T10:00:10.000Z');
    const buffered = [
      { latitude: 52.51, longitude: 13.4, capturedAt: new Date('2026-06-28T10:00:05.000Z') },
      // Out of order on input; must be sorted ascending before the live point.
      { latitude: 52.515, longitude: 13.402, capturedAt: new Date('2026-06-28T10:00:00.000Z') },
      // Newer than the live point; must be dropped (kept the freshest single live point).
      { latitude: 99, longitude: 13, capturedAt: new Date('2026-06-28T10:00:20.000Z') },
    ];

    await service.updateLocation(
      'scoped-token',
      orderId,
      {
        latitude: 52.52,
        longitude: 13.405,
        capturedAt: liveCapturedAt,
        updateId: '694c4e52-72f1-4b0c-b6f2-88ac61732cf3',
      },
      buffered,
    );

    // Exactly one trail write, regardless of how many points were batched.
    expect(orderTrailModel.updateOne).toHaveBeenCalledTimes(1);
    const writeArg = orderTrailModel.updateOne.mock.calls[0][1];
    const pushed = writeArg.$push.points;
    expect(pushed.$slice).toBe(-5000);
    expect(pushed.$each.map((p: { latitude: number }) => p.latitude)).toEqual([
      52.515, // earliest buffered
      52.51, // later buffered
      52.52, // live point, always last
    ]);
    // Only the freshest point is broadcast live.
    expect(pubSub.publish).toHaveBeenCalledTimes(1);
  });

  it('closes a customer subscription when a terminal marker arrives', async () => {
    const orderId = '65a4d4b5e95f1a07a5a3d111';
    async function* channel() {
      yield { orderRiderLocationUpdated: { orderId, latitude: 1, longitude: 2 } };
      yield { orderRiderLocationUpdated: null, __terminated: true };
      // Emitted only if the iterator failed to close on the terminal marker.
      yield { orderRiderLocationUpdated: { orderId, latitude: 9, longitude: 9 } };
    }
    const userModel = {
      findOne: jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve({ _id: '65a4d4b5e95f1a07a5a3d333' }) }),
      }),
    };
    const orderModel = {
      findOne: jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve({ _id: orderId }) }),
      }),
    };
    const pubSub = { asyncIterableIterator: jest.fn().mockReturnValue(channel()) };
    const service = new TrackingService(
      {} as never,
      pubSub as never,
      orderModel as never,
      {} as never,
      userModel as never,
      {} as never,
      testConfig,
      {} as never,
    );

    const iterator = await service.customerIterator('owner', orderId);
    const received: unknown[] = [];
    for await (const event of iterator) received.push(event);

    expect(received).toEqual([
      { orderRiderLocationUpdated: { orderId, latitude: 1, longitude: 2 } },
    ]);
  });

  it('publishes a terminal marker before revoking on cleanup', async () => {
    const orderId = '65a4d4b5e95f1a07a5a3d111';
    const redis = {
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
    };
    const pubSub = { publish: jest.fn().mockResolvedValue(undefined) };
    const service = new TrackingService(
      redis as never,
      pubSub as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      testConfig,
      {} as never,
    );

    await service.terminateOrderTracking(orderId);

    expect(pubSub.publish).toHaveBeenCalledWith(
      `tracking:order:${orderId}:events`,
      expect.objectContaining({ orderRiderLocationUpdated: null, __terminated: true }),
    );
    expect(redis.del).toHaveBeenCalled();
  });

  it('denies a customer who does not own a picked order', async () => {
    const userModel = {
      findOne: jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve({ _id: '65a4d4b5e95f1a07a5a3d333' }) }),
      }),
    };
    const orderModel = {
      findOne: jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(null) }),
      }),
    };
    const service = new TrackingService(
      {} as never,
      {} as never,
      orderModel as never,
      {} as never,
      userModel as never,
      {} as never,
      testConfig,
      {} as never,
    );

    await expect(
      service.getCustomerLocation('other-customer', '65a4d4b5e95f1a07a5a3d111'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('persists dispatch presence to Mongo after refreshing Redis', async () => {
    const exec = jest.fn().mockResolvedValue({ modifiedCount: 1 });
    const riderModel = {
      findOne: jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve({ _id: '65a4d4b5e95f1a07a5a3d222' }) }),
      }),
      updateOne: jest.fn().mockReturnValue({ exec }),
    };
    const tx = { geoadd: jest.fn(), set: jest.fn(), exec: jest.fn().mockResolvedValue([]) };
    const service = new TrackingService(
      { multi: () => tx } as never,
      {} as never,
      {} as never,
      riderModel as never,
      {} as never,
      {} as never,
      testConfig,
      {} as never,
    );

    await service.updatePresence('clerk-rider', {
      latitude: 52.52,
      longitude: 13.405,
      capturedAt: new Date(),
      updateId: '694c4e52-72f1-4b0c-b6f2-88ac61732cf3',
    });

    expect(riderModel.updateOne).toHaveBeenCalledWith(
      { _id: '65a4d4b5e95f1a07a5a3d222' },
      expect.objectContaining({
        $set: expect.objectContaining({
          lastKnownLocation: { type: 'Point', coordinates: [13.405, 52.52] },
          lastSeenAt: expect.any(Date),
        }),
      }),
    );
    expect(exec).toHaveBeenCalled();
  });

  it('queries Mongo fallback with radius and freshness constraints', async () => {
    const exec = jest.fn().mockResolvedValue([{ _id: '65a4d4b5e95f1a07a5a3d222' }]);
    const find = jest.fn().mockReturnValue({ lean: () => ({ exec }) });
    const service = new TrackingService(
      {} as never,
      {} as never,
      {} as never,
      { find } as never,
      {} as never,
      {} as never,
      testConfig,
      {} as never,
    );

    await expect(service.findNearbyRiderIdsFromMongo(13.405, 52.52, 8)).resolves.toEqual([
      '65a4d4b5e95f1a07a5a3d222',
    ]);
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        lastSeenAt: { $gte: expect.any(Date) },
        lastKnownLocation: {
          $geoWithin: { $centerSphere: [[13.405, 52.52], 8 / 6378.1] },
        },
      }),
      '_id',
    );
  });

  it('combines Redis and Mongo dispatch presence when Redis is degraded', async () => {
    const service = new TrackingService(
      { status: 'reconnecting' } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      testConfig,
      {} as never,
    );
    jest.spyOn(service, 'findNearbyRiderIds').mockResolvedValue(['rider-1']);
    jest.spyOn(service, 'findNearbyRiderIdsFromMongo').mockResolvedValue(['rider-1', 'rider-2']);

    await expect(
      service.findDispatchablePresence({ longitude: 13.405, latitude: 52.52, radiusKm: 15 }),
    ).resolves.toEqual({
      riderIds: ['rider-1', 'rider-2'],
      source: 'redis+mongo',
    });
  });

  it('rejects an invalid dispatch presence token', async () => {
    const service = new TrackingService(
      { get: jest.fn().mockResolvedValue(null) } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      testConfig,
      {} as never,
    );
    await expect(
      service.updatePresenceByToken('invalid', {
        latitude: 52.52,
        longitude: 13.405,
        capturedAt: new Date(),
        updateId: '694c4e52-72f1-4b0c-b6f2-88ac61732cf3',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('TrackingService fleet location throttle (writePresence -> fleetRiderLocationUpdated)', () => {
  const makeMultiChain = () => {
    const chain: any = {};
    chain.geoadd = () => chain;
    chain.set = () => chain;
    chain.exec = () => Promise.resolve();
    return chain;
  };

  const makeService = () => {
    const redis = { multi: jest.fn().mockImplementation(() => makeMultiChain()) };
    const pubSub = { publish: jest.fn().mockResolvedValue(undefined) };
    const riderModel = { updateOne: jest.fn().mockReturnValue({ exec: () => Promise.resolve() }) };
    const service = new TrackingService(
      redis as never,
      pubSub as never,
      {} as never,
      riderModel as never,
      {} as never,
      {} as never,
      testConfig,
      {} as never,
    );
    return { service, pubSub };
  };

  it('publishes on first write, throttles a sub-15m move, and publishes again once moved past 15m', async () => {
    const { service, pubSub } = makeService();

    await (service as any).writePresence('rider-1', { latitude: 34.74, longitude: 10.76 });
    expect(pubSub.publish).toHaveBeenCalledTimes(1);
    expect(pubSub.publish).toHaveBeenCalledWith(
      'RIDER_LOCATION_UPDATED',
      expect.objectContaining({
        RIDER_LOCATION_UPDATED: expect.objectContaining({ riderId: 'rider-1' }),
      }),
    );

    // ~1m move, same instant -> throttled (below both the distance and time thresholds).
    await (service as any).writePresence('rider-1', { latitude: 34.74001, longitude: 10.76 });
    expect(pubSub.publish).toHaveBeenCalledTimes(1);

    // ~22m move -> publishes immediately even though no time has elapsed.
    await (service as any).writePresence('rider-1', { latitude: 34.7402, longitude: 10.76 });
    expect(pubSub.publish).toHaveBeenCalledTimes(2);
  });

  it('throttles independently per rider', async () => {
    const { service, pubSub } = makeService();
    await (service as any).writePresence('rider-1', { latitude: 34.74, longitude: 10.76 });
    await (service as any).writePresence('rider-2', { latitude: 34.74, longitude: 10.76 });
    expect(pubSub.publish).toHaveBeenCalledTimes(2);
  });
});

describe('TrackingService.getRiderDayTrail', () => {
  const riderId = '65a4d4b5e95f1a07a5a3d222';
  const chain = (value: unknown) => {
    const q: any = {};
    q.populate = () => q;
    q.sort = () => q;
    q.lean = () => q;
    q.exec = () => Promise.resolve(value);
    return q;
  };

  it('concatenates each order\'s trail points in chronological order and returns the day\'s stops', async () => {
    const orders = [
      {
        _id: 'order-1',
        orderId: 'ORD-1',
        orderStatus: 'DELIVERED',
        assignedAt: '2026-07-17T08:00:00.000Z',
        pickedAt: '2026-07-17T08:10:00.000Z',
        deliveredAt: '2026-07-17T08:30:00.000Z',
        restaurant: { _id: 'r1', name: 'Resto A' },
      },
      {
        _id: 'order-2',
        orderId: 'ORD-2',
        orderStatus: 'DELIVERED',
        assignedAt: '2026-07-17T09:00:00.000Z',
        pickedAt: '2026-07-17T09:10:00.000Z',
        deliveredAt: '2026-07-17T09:30:00.000Z',
        restaurant: { _id: 'r2', name: 'Resto B' },
      },
    ];
    const trails = [
      { order: 'order-2', points: [{ latitude: 2, longitude: 2, capturedAt: '2026-07-17T09:15:00.000Z' }] },
      { order: 'order-1', points: [{ latitude: 1, longitude: 1, capturedAt: '2026-07-17T08:15:00.000Z' }] },
    ];
    const orderModel = { find: jest.fn().mockReturnValue(chain(orders)) };
    const orderTrailModel = { find: jest.fn().mockReturnValue(chain(trails)) };
    const service = new TrackingService(
      {} as never,
      {} as never,
      orderModel as never,
      {} as never,
      {} as never,
      orderTrailModel as never,
      testConfig,
      {} as never,
    );

    const dayTrail = await service.getRiderDayTrail(riderId, '2026-07-17');

    expect(dayTrail.riderId).toBe(riderId);
    expect(dayTrail.date).toBe('2026-07-17');
    expect(dayTrail.stops).toHaveLength(2);
    expect(dayTrail.stops[0].orderDisplayId).toBe('ORD-1');
    expect(dayTrail.stops[0].restaurantName).toBe('Resto A');
    expect(dayTrail.points).toHaveLength(2);
    // Chronologically ordered despite the trails array being fetched out of order.
    expect(dayTrail.points[0].orderId).toBe('order-1');
    expect(dayTrail.points[1].orderId).toBe('order-2');
  });

  it('returns empty points/stops and skips the trail lookup when the rider has no orders that day', async () => {
    const orderModel = { find: jest.fn().mockReturnValue(chain([])) };
    const orderTrailModel = { find: jest.fn() };
    const service = new TrackingService(
      {} as never,
      {} as never,
      orderModel as never,
      {} as never,
      {} as never,
      orderTrailModel as never,
      testConfig,
      {} as never,
    );

    const dayTrail = await service.getRiderDayTrail(riderId, '2026-07-17');
    expect(dayTrail).toEqual({ riderId, date: '2026-07-17', points: [], stops: [] });
    expect(orderTrailModel.find).not.toHaveBeenCalled();
  });

  it('rejects an invalid date string', async () => {
    const service = new TrackingService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      testConfig,
      {} as never,
    );
    await expect(service.getRiderDayTrail(riderId, 'not-a-date')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
