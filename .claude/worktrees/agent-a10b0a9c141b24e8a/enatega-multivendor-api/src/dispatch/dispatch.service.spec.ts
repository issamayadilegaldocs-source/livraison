import { DispatchService } from './dispatch.service';

const makeService = (overrides: Partial<Record<string, unknown>> = {}) =>
  new DispatchService(
    (overrides.restaurantsService ?? {}) as never,
    (overrides.ridersService ?? {}) as never,
    (overrides.trackingService ?? {}) as never,
    (overrides.notificationsService ?? {}) as never,
    (overrides.orderModel ?? {}) as never,
    (overrides.googleRoutesProvider ?? {}) as never,
  );

describe('DispatchService', () => {
  it('selects Mongo fallback riders and sends nearby-order pushes', async () => {
    const restaurantsService = {
      getDispatchOrigin: jest.fn().mockResolvedValue({
        restaurantId: 'restaurant-1',
        name: 'Löwenstadt Pizza',
        longitude: 13.405,
        latitude: 52.52,
      }),
    };
    const trackingService = {
      findDispatchablePresence: jest.fn().mockResolvedValue({
        riderIds: ['rider-1'],
        source: 'mongo',
      }),
    };
    const ridersService = {
      findDispatchNotificationTargets: jest
        .fn()
        .mockResolvedValue([{ riderId: 'rider-1', notificationToken: 'expo-token' }]),
    };
    const notificationsService = {
      sendNearbyOrderPushes: jest.fn().mockResolvedValue(1),
    };
    const service = makeService({
      restaurantsService,
      ridersService,
      trackingService,
      notificationsService,
    });

    await expect(
      service.notifyNearbyRiders({
        orderId: 'order-1',
        restaurantId: 'restaurant-1',
        zoneId: 'zone-1',
        radiusKm: 8,
        reason: 'prepared',
      }),
    ).resolves.toEqual({
      orderId: 'order-1',
      attemptedRiderIds: ['rider-1'],
      notifiedCount: 1,
      source: 'mongo',
    });
    expect(trackingService.findDispatchablePresence).toHaveBeenCalledWith({
      longitude: 13.405,
      latitude: 52.52,
      radiusKm: 8,
    });
    expect(ridersService.findDispatchNotificationTargets).toHaveBeenCalledWith({
      riderIds: ['rider-1'],
      zoneId: 'zone-1',
    });
    expect(notificationsService.sendNearbyOrderPushes).toHaveBeenCalledWith(
      [{ riderId: 'rider-1', notificationToken: 'expo-token' }],
      { orderId: 'order-1', restaurantName: 'Löwenstadt Pizza' },
    );
  });

  it('skips dispatch when the restaurant origin has no coordinates', async () => {
    const service = makeService({
      restaurantsService: { getDispatchOrigin: jest.fn().mockResolvedValue(null) },
    });

    await expect(
      service.notifyNearbyRiders({
        orderId: 'order-1',
        restaurantId: 'restaurant-1',
        radiusKm: 8,
        reason: 'prepared',
      }),
    ).resolves.toEqual({
      orderId: 'order-1',
      attemptedRiderIds: [],
      notifiedCount: 0,
      source: 'none',
      skippedReason: 'missing_origin',
    });
  });
});

describe('DispatchService.suggestRidersForOrder', () => {
  const leanExec = (value: unknown) => ({ lean: () => ({ exec: () => Promise.resolve(value) }) });
  const origin = { restaurantId: 'restaurant-1', name: 'Resto', longitude: 10, latitude: 34 };

  it('ranks candidates by score and refines the top candidates\' ETA via Google Routes', async () => {
    const orderModel = {
      findById: jest.fn().mockReturnValue(leanExec({ restaurant: 'restaurant-1', zone: 'zone-1' })),
    };
    const restaurantsService = { getDispatchOrigin: jest.fn().mockResolvedValue(origin) };
    const trackingService = {
      findDispatchablePresence: jest.fn().mockResolvedValue({ riderIds: ['r1', 'r2'], source: 'redis' }),
    };
    const ridersService = {
      findByIds: jest.fn().mockResolvedValue([
        {
          _id: 'r1',
          name: 'Ali',
          phone: '123',
          vehicleType: 'MOTO',
          assigned: false,
          acceptedAssignmentsCount: 9,
          rejectedAssignmentsCount: 1,
          zone: 'zone-1',
          lastKnownLocation: { coordinates: [10.01, 34.01] },
        },
        {
          _id: 'r2',
          name: 'Sam',
          phone: '456',
          vehicleType: 'CAR',
          assigned: true,
          acceptedAssignmentsCount: 2,
          rejectedAssignmentsCount: 8,
          zone: 'zone-2',
          lastKnownLocation: { coordinates: [10.5, 34.5] },
        },
      ]),
    };
    const googleRoutesProvider = {
      travelMinutes: jest.fn().mockResolvedValueOnce(8).mockResolvedValueOnce(25),
    };
    const service = makeService({
      orderModel,
      restaurantsService,
      trackingService,
      ridersService,
      googleRoutesProvider,
    });

    const suggestions = await service.suggestRidersForOrder('order-1', 10);

    expect(suggestions).toHaveLength(2);
    expect(suggestions[0].riderId).toBe('r1'); // closer, free, higher acceptance, same zone
    expect(suggestions[0].score).toBeGreaterThan(suggestions[1].score);
    expect(suggestions[0].etaMinutes).toBe(8);
    expect(suggestions[1].etaMinutes).toBe(25);
    expect(suggestions[0].reasons.length).toBeGreaterThan(0);
  });

  it('fails soft to straight-line distance only when Google Routes rejects', async () => {
    const orderModel = { findById: jest.fn().mockReturnValue(leanExec({ restaurant: 'restaurant-1' })) };
    const restaurantsService = { getDispatchOrigin: jest.fn().mockResolvedValue(origin) };
    const trackingService = {
      findDispatchablePresence: jest.fn().mockResolvedValue({ riderIds: ['r1'], source: 'redis' }),
    };
    const ridersService = {
      findByIds: jest.fn().mockResolvedValue([
        { _id: 'r1', assigned: false, lastKnownLocation: { coordinates: [10.01, 34.01] } },
      ]),
    };
    const googleRoutesProvider = { travelMinutes: jest.fn().mockRejectedValue(new Error('timeout')) };
    const service = makeService({
      orderModel,
      restaurantsService,
      trackingService,
      ridersService,
      googleRoutesProvider,
    });

    const [suggestion] = await service.suggestRidersForOrder('order-1');
    expect(suggestion.etaMinutes).toBeUndefined();
    expect(suggestion.distanceKm).toBeGreaterThan(0);
  });

  it('returns an empty list when the order has no restaurant, or the restaurant has no dispatch origin', async () => {
    const noRestaurant = makeService({
      orderModel: { findById: jest.fn().mockReturnValue(leanExec({})) },
    });
    await expect(noRestaurant.suggestRidersForOrder('order-1')).resolves.toEqual([]);

    const noOrigin = makeService({
      orderModel: { findById: jest.fn().mockReturnValue(leanExec({ restaurant: 'restaurant-1' })) },
      restaurantsService: { getDispatchOrigin: jest.fn().mockResolvedValue(null) },
    });
    await expect(noOrigin.suggestRidersForOrder('order-1')).resolves.toEqual([]);
  });
});

describe('DispatchService.estimateReassignmentImpact', () => {
  const leanExec = (value: unknown) => ({ lean: () => ({ exec: () => Promise.resolve(value) }) });
  const origin = { restaurantId: 'restaurant-1', name: 'Resto', longitude: 10, latitude: 34 };

  it('computes distance saved and before/after ETA from the current vs candidate rider', async () => {
    const orderModel = {
      findById: jest.fn().mockReturnValue(leanExec({ restaurant: 'restaurant-1', rider: 'current-rider' })),
    };
    const restaurantsService = { getDispatchOrigin: jest.fn().mockResolvedValue(origin) };
    const ridersService = {
      findById: jest.fn().mockImplementation((id: string) =>
        Promise.resolve(
          id === 'current-rider'
            ? { _id: 'current-rider', lastKnownLocation: { coordinates: [10.5, 34.5] } }
            : { _id: 'candidate-rider', lastKnownLocation: { coordinates: [10.01, 34.01] } },
        ),
      ),
    };
    const googleRoutesProvider = {
      travelMinutes: jest.fn().mockResolvedValueOnce(22).mockResolvedValueOnce(4),
    };
    const service = makeService({ orderModel, restaurantsService, ridersService, googleRoutesProvider });

    const impact = await service.estimateReassignmentImpact('order-1', 'candidate-rider');
    expect(impact.currentRiderId).toBe('current-rider');
    expect(impact.candidateRiderId).toBe('candidate-rider');
    expect(impact.etaBeforeMinutes).toBe(22);
    expect(impact.etaAfterMinutes).toBe(4);
    expect(impact.distanceSavedKm).toBeGreaterThan(0); // candidate is much closer
  });

  it('fails soft (undefined ETA/distance) when a rider has no last-known location', async () => {
    const orderModel = {
      findById: jest.fn().mockReturnValue(leanExec({ restaurant: 'restaurant-1', rider: null })),
    };
    const restaurantsService = { getDispatchOrigin: jest.fn().mockResolvedValue(origin) };
    const ridersService = {
      findById: jest.fn().mockResolvedValue({ _id: 'candidate-rider' }), // no lastKnownLocation
    };
    const googleRoutesProvider = { travelMinutes: jest.fn() };
    const service = makeService({ orderModel, restaurantsService, ridersService, googleRoutesProvider });

    const impact = await service.estimateReassignmentImpact('order-1', 'candidate-rider');
    expect(impact.currentRiderId).toBeUndefined();
    expect(impact.etaBeforeMinutes).toBeUndefined();
    expect(impact.etaAfterMinutes).toBeUndefined();
    expect(impact.distanceSavedKm).toBeUndefined();
    expect(googleRoutesProvider.travelMinutes).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the order does not exist', async () => {
    const service = makeService({ orderModel: { findById: jest.fn().mockReturnValue(leanExec(null)) } });
    await expect(service.estimateReassignmentImpact('missing', 'candidate-rider')).rejects.toThrow(
      'Order missing not found',
    );
  });
});
