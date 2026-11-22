import { NotFoundException } from '@nestjs/common';
import { OperationsService } from './operations.service';
import { DispatchHotspotType, ZoneOperationalStatus } from './operations.model';

const makeService = (overrides: Partial<Record<string, unknown>> = {}) =>
  new OperationsService(
    (overrides.orderModel ?? {}) as never,
    (overrides.restaurantModel ?? {}) as never,
    (overrides.riderModel ?? {}) as never,
    (overrides.zoneModel ?? {}) as never,
    (overrides.trackingService ?? {}) as never,
  );

describe('OperationsService.getRiderOperationalProfile', () => {
  const riderId = '65a4d4b5e95f1a07a5a3d222';

  const riderFindByIdChain = (doc: unknown) => ({
    populate: () => ({
      lean: () => ({ exec: () => Promise.resolve(doc) }),
    }),
  });

  it('throws NotFoundException when the rider does not exist', async () => {
    const riderModel = { findById: jest.fn().mockReturnValue(riderFindByIdChain(null)) };
    const service = makeService({ riderModel });
    await expect(service.getRiderOperationalProfile(riderId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('computes acceptance rate, cash collected and on-time rate from today\'s delivered orders', async () => {
    const riderModel = {
      findById: jest.fn().mockReturnValue(
        riderFindByIdChain({
          _id: riderId,
          name: 'Sami',
          phone: '+21650000000',
          vehicleType: 'MOTO',
          vehicleDetails: { number: '123 TUN 456' },
          available: true,
          assigned: false,
          acceptedAssignmentsCount: 18,
          rejectedAssignmentsCount: 2,
          currentWalletAmount: 42.5,
          lastSeenAt: new Date('2026-07-17T08:00:00.000Z'),
          zone: { _id: 'zone-1', title: 'Centre-Ville' },
        }),
      ),
    };
    const orderModel = {
      find: jest.fn().mockReturnValue({
        lean: () => ({
          exec: () =>
            Promise.resolve([
              {
                paymentMethod: 'COD',
                codCollectedAt: '2026-07-17T09:00:00.000Z',
                orderAmountMinor: 1250,
                expectedTime: '2026-07-17T09:10:00.000Z',
                deliveredAt: '2026-07-17T09:05:00.000Z',
              },
              {
                paymentMethod: 'COD',
                codCollectedAt: '2026-07-17T10:00:00.000Z',
                orderAmount: 8, // no Minor field -> falls back to ×100
                expectedTime: '2026-07-17T10:05:00.000Z',
                deliveredAt: '2026-07-17T10:20:00.000Z', // late
              },
              {
                paymentMethod: 'ONLINE', // not COD -> excluded from cash collected
                orderAmountMinor: 5000,
                expectedTime: undefined,
                deliveredAt: '2026-07-17T11:00:00.000Z',
              },
            ]),
        }),
      }),
    };
    const trackingService = { listOnlineRiderIds: jest.fn().mockResolvedValue([riderId]) };
    const service = makeService({ riderModel, orderModel, trackingService });

    const profile = await service.getRiderOperationalProfile(riderId);

    expect(profile.riderId).toBe(riderId);
    expect(profile.online).toBe(true);
    expect(profile.acceptedAssignmentsCount).toBe(18);
    expect(profile.rejectedAssignmentsCount).toBe(2);
    expect(profile.acceptanceRatePct).toBeCloseTo(90, 5); // 18/20
    expect(profile.deliveriesTodayCount).toBe(3);
    expect(profile.cashCollectedTodayMinor).toBe(1250 + 800); // COD orders only
    expect(profile.onTimeRatePct).toBeCloseTo(50, 5); // 1 on-time of 2 timed orders
    expect(profile.zoneId).toBe('zone-1');
    expect(profile.zoneTitle).toBe('Centre-Ville');
    expect(profile.licensePlate).toBe('123 TUN 456');
  });

  it('leaves acceptanceRatePct/onTimeRatePct undefined with no history (not a 0/0 divide)', async () => {
    const riderModel = {
      findById: jest.fn().mockReturnValue(
        riderFindByIdChain({
          _id: riderId,
          acceptedAssignmentsCount: 0,
          rejectedAssignmentsCount: 0,
        }),
      ),
    };
    const orderModel = { find: jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.resolve([]) }) }) };
    const trackingService = { listOnlineRiderIds: jest.fn().mockResolvedValue([]) };
    const service = makeService({ riderModel, orderModel, trackingService });

    const profile = await service.getRiderOperationalProfile(riderId);
    expect(profile.acceptanceRatePct).toBeUndefined();
    expect(profile.onTimeRatePct).toBeUndefined();
    expect(profile.cashCollectedTodayMinor).toBe(0);
    expect(profile.deliveriesTodayCount).toBe(0);
    expect(profile.online).toBe(false);
  });
});

describe('OperationsService.getZoneOperationalStats', () => {
  const leanExec = (value: unknown) => ({ lean: () => ({ exec: () => Promise.resolve(value) }) });

  it('derives riderCount breakdown, saturationScore and status per zone', async () => {
    const zoneModel = {
      find: jest.fn().mockReturnValue(
        leanExec([
          { _id: 'zone-1', title: 'Centre' },
          { _id: 'zone-2', title: 'Sud' },
        ]),
      ),
    };
    const riderModel = {
      find: jest.fn().mockReturnValue(
        leanExec([
          { _id: 'r1', zone: 'zone-1', assigned: true },
          { _id: 'r2', zone: 'zone-1', assigned: false },
          { _id: 'r3', zone: 'zone-2', assigned: false },
        ]),
      ),
    };
    const orderModel = {
      aggregate: jest
        .fn()
        // 1) active orders by zone
        .mockResolvedValueOnce([
          { _id: 'zone-1', count: 10 },
          { _id: 'zone-2', count: 1 },
        ])
        // 2) recent delivery timing by zone
        .mockResolvedValueOnce([{ _id: 'zone-1', avgDeliveryMinutes: 25 }])
        // 3) late active orders by zone
        .mockResolvedValueOnce([{ _id: 'zone-1', count: 8 }]),
    };
    const restaurantModel = {
      aggregate: jest.fn().mockResolvedValueOnce([
        { _id: 'zone-1', count: 3 },
        { _id: 'zone-2', count: 2 },
      ]),
    };
    const trackingService = { listOnlineRiderIds: jest.fn().mockResolvedValue(['r1', 'r2', 'r3']) };
    const service = makeService({ zoneModel, riderModel, orderModel, restaurantModel, trackingService });

    const stats = await service.getZoneOperationalStats();
    expect(stats).toHaveLength(2);

    const centre = stats.find((z) => z.zoneId === 'zone-1')!;
    expect(centre.riderCount).toEqual({ online: 2, busy: 1, idle: 1 });
    expect(centre.activeOrdersCount).toBe(10);
    expect(centre.openStoresCount).toBe(3);
    expect(centre.avgDeliveryMinutes).toBe(25);
    expect(centre.lateCount).toBe(8);
    // loadRatio 10/2=5 capped at 4 -> 70pts; lateRatio 8/10=0.8 -> 24pts => 94
    expect(centre.saturationScore).toBe(94);
    expect(centre.status).toBe(ZoneOperationalStatus.CRITICAL);

    const sud = stats.find((z) => z.zoneId === 'zone-2')!;
    expect(sud.riderCount).toEqual({ online: 1, busy: 0, idle: 1 });
    expect(sud.activeOrdersCount).toBe(1);
    expect(sud.lateCount).toBe(0);
    expect(sud.avgDeliveryMinutes).toBeUndefined();
    // loadRatio 1/1=1 -> 17.5pts, no lateness -> HEALTHY
    expect(sud.saturationScore).toBe(18);
    expect(sud.status).toBe(ZoneOperationalStatus.HEALTHY);
  });

  it('treats a zone with active orders and zero online riders as fully saturated on the load axis', async () => {
    const zoneModel = { find: jest.fn().mockReturnValue(leanExec([{ _id: 'zone-3', title: 'Nord' }])) };
    const riderModel = { find: jest.fn().mockReturnValue(leanExec([])) };
    const orderModel = {
      aggregate: jest
        .fn()
        .mockResolvedValueOnce([{ _id: 'zone-3', count: 2 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
    };
    const restaurantModel = { aggregate: jest.fn().mockResolvedValueOnce([]) };
    const trackingService = { listOnlineRiderIds: jest.fn().mockResolvedValue([]) };
    const service = makeService({ zoneModel, riderModel, orderModel, restaurantModel, trackingService });

    const [nord] = await service.getZoneOperationalStats();
    expect(nord.riderCount).toEqual({ online: 0, busy: 0, idle: 0 });
    // 0 online riders + active orders => loadRatio maxes at 4 -> 70pts -> SATURATED (>=60, <85)
    expect(nord.saturationScore).toBe(70);
    expect(nord.status).toBe(ZoneOperationalStatus.SATURATED);
  });
});

describe('OperationsService.getDispatchHotspots', () => {
  const leanExec = (value: unknown) => ({ lean: () => ({ exec: () => Promise.resolve(value) }) });

  it('emits a NO_RIDER zone hotspot and a SLOW_RESTAURANT hotspot, skipping healthy/low-volume zones', async () => {
    const zoneStats = [
      {
        zoneId: 'zone-1',
        zoneTitle: 'Centre',
        riderCount: { online: 0, busy: 0, idle: 0 },
        activeOrdersCount: 3,
        openStoresCount: 2,
        avgDeliveryMinutes: undefined,
        lateCount: 0,
        saturationScore: 70,
        status: ZoneOperationalStatus.SATURATED,
      },
      {
        zoneId: 'zone-2',
        zoneTitle: 'Sud',
        riderCount: { online: 2, busy: 0, idle: 2 },
        activeOrdersCount: 1,
        openStoresCount: 1,
        avgDeliveryMinutes: 20,
        lateCount: 0,
        saturationScore: 10,
        status: ZoneOperationalStatus.HEALTHY,
      },
    ];
    const zoneModel = {
      find: jest.fn().mockReturnValue(
        leanExec([
          {
            _id: 'zone-1',
            location: {
              coordinates: [
                [
                  [10.0, 34.0],
                  [10.2, 34.0],
                  [10.1, 34.2],
                  [10.0, 34.0],
                ],
              ],
            },
          },
          {
            _id: 'zone-2',
            location: {
              coordinates: [
                [
                  [9.0, 33.0],
                  [9.2, 33.0],
                  [9.1, 33.2],
                  [9.0, 33.0],
                ],
              ],
            },
          },
        ]),
      ),
    };
    const orderModel = {
      aggregate: jest.fn().mockResolvedValueOnce([{ _id: 'restaurant-1', count: 3 }]),
    };
    const restaurantModel = {
      find: jest.fn().mockReturnValue(
        leanExec([
          {
            _id: 'restaurant-1',
            name: 'Pizzeria Roma',
            location: { coordinates: [10.05, 34.05] },
            zone: 'zone-1',
          },
        ]),
      ),
    };
    const service = makeService({ zoneModel, orderModel, restaurantModel });

    const hotspots = await service.getDispatchHotspots(zoneStats as any);

    const zoneHotspot = hotspots.find((h) => h.type === DispatchHotspotType.NO_RIDER);
    expect(zoneHotspot).toBeDefined();
    expect(zoneHotspot!.zoneId).toBe('zone-1');
    expect(zoneHotspot!.orderCount).toBe(3);

    expect(hotspots.some((h) => h.zoneId === 'zone-2')).toBe(false);

    const restaurantHotspot = hotspots.find((h) => h.type === DispatchHotspotType.SLOW_RESTAURANT);
    expect(restaurantHotspot).toBeDefined();
    expect(restaurantHotspot!.latitude).toBe(34.05);
    expect(restaurantHotspot!.longitude).toBe(10.05);
    expect(restaurantHotspot!.orderCount).toBe(3);
    expect(restaurantHotspot!.zoneId).toBe('zone-1');
  });

  it('reuses a precomputed zoneStats array instead of recomputing it', async () => {
    const zoneModel = { find: jest.fn().mockReturnValue(leanExec([])) };
    const orderModel = { aggregate: jest.fn().mockResolvedValueOnce([]) };
    const service = makeService({ zoneModel, orderModel });

    const hotspots = await service.getDispatchHotspots([]);
    expect(hotspots).toEqual([]);
    // Only the geometry fetch runs — getZoneOperationalStats' own zone fetch is skipped.
    expect(zoneModel.find).toHaveBeenCalledTimes(1);
  });
});

describe('OperationsService.getCrisisSnapshot', () => {
  it('composes overview + zone stats + hotspots + alerts into one snapshot', async () => {
    const orderModel = { countDocuments: jest.fn().mockReturnValue({ exec: () => Promise.resolve(4) }) };
    const service = makeService({ orderModel });

    jest.spyOn(service, 'getOperationsOverview').mockResolvedValue({
      orders: { pendingCount: 7 },
    } as any);
    jest.spyOn(service, 'getZoneOperationalStats').mockResolvedValue([
      {
        zoneId: 'zone-1',
        zoneTitle: 'Centre',
        riderCount: { online: 1, busy: 1, idle: 0 },
        activeOrdersCount: 9,
        openStoresCount: 2,
        avgDeliveryMinutes: 30,
        lateCount: 2,
        saturationScore: 90,
        status: ZoneOperationalStatus.CRITICAL,
      },
      {
        zoneId: 'zone-2',
        zoneTitle: 'Sud',
        riderCount: { online: 3, busy: 0, idle: 3 },
        activeOrdersCount: 1,
        openStoresCount: 1,
        avgDeliveryMinutes: 15,
        lateCount: 0,
        saturationScore: 5,
        status: ZoneOperationalStatus.HEALTHY,
      },
    ] as any);
    jest.spyOn(service, 'getDispatchHotspots').mockResolvedValue([
      {
        latitude: 1,
        longitude: 1,
        radiusMeters: 300,
        orderCount: 3,
        type: DispatchHotspotType.SLOW_RESTAURANT,
        label: 'x',
      },
    ] as any);
    jest.spyOn(service, 'getOperationalAlerts').mockResolvedValue([
      {
        id: 'CITYWIDE:CITYWIDE_DISPATCH_EMERGENCY',
        type: 'CITYWIDE_DISPATCH_EMERGENCY',
        severity: 'EMERGENCY',
        minutesSince: 5,
        suggestedAction: 'ESCALATE',
      },
    ] as any);

    const snapshot = await service.getCrisisSnapshot();

    expect(snapshot.pendingOrdersCount).toBe(7);
    expect(snapshot.unassignedOrdersCount).toBe(4);
    expect(snapshot.saturatedZones).toHaveLength(1);
    expect(snapshot.saturatedZones[0].zoneId).toBe('zone-1');
    expect(snapshot.restaurantsOverwhelmedCount).toBe(1);
    expect(snapshot.ridersShortCount).toBe(1); // zone-1: 9 active orders, 1 online rider -> short
    expect(snapshot.isEmergency).toBe(true);
    expect(snapshot.topProblems[0]).toContain('Centre');
  });

  it('reports no crisis and a friendly placeholder when everything is healthy', async () => {
    const orderModel = { countDocuments: jest.fn().mockReturnValue({ exec: () => Promise.resolve(0) }) };
    const service = makeService({ orderModel });
    jest.spyOn(service, 'getOperationsOverview').mockResolvedValue({ orders: { pendingCount: 0 } } as any);
    jest.spyOn(service, 'getZoneOperationalStats').mockResolvedValue([]);
    jest.spyOn(service, 'getDispatchHotspots').mockResolvedValue([]);
    jest.spyOn(service, 'getOperationalAlerts').mockResolvedValue([]);

    const snapshot = await service.getCrisisSnapshot();
    expect(snapshot.isEmergency).toBe(false);
    expect(snapshot.topProblems).toEqual(['Aucun problème critique détecté']);
  });
});

describe('OperationsService.getOperationalAlerts (v2 rider/zone/scheduled/emergency alerts)', () => {
  const chain = (value: unknown) => {
    const obj: any = {};
    obj.select = () => obj;
    obj.populate = () => obj;
    obj.lean = () => ({ exec: () => Promise.resolve(value) });
    return obj;
  };

  it('flags a stale-but-online idle rider and a rider with several rejections and a poor acceptance rate', async () => {
    const staleLastSeenAt = new Date(Date.now() - 20 * 60_000); // 20 min ago > 12 min threshold
    const riders = [
      {
        _id: 'r1',
        name: 'Ali',
        available: true,
        assigned: false,
        lastSeenAt: staleLastSeenAt,
        zone: 'zone-1',
        acceptedAssignmentsCount: 5,
        rejectedAssignmentsCount: 1,
      },
      {
        _id: 'r2',
        name: 'Sam',
        available: true,
        assigned: false,
        lastSeenAt: new Date(),
        zone: 'zone-1',
        acceptedAssignmentsCount: 2,
        rejectedAssignmentsCount: 5, // 2/(2+5)=28.6% < 50%, rejected>=3 -> RIDER_REJECTED_MULTIPLE
      },
    ];
    const orderModel = {
      find: jest.fn().mockImplementation((filter: any) =>
        filter?.orderStatus === 'SCHEDULED' ? chain([]) : chain([]),
      ),
      aggregate: jest.fn().mockResolvedValue([]),
    };
    const riderModel = { find: jest.fn().mockReturnValue(chain(riders)) };
    const zoneModel = { find: jest.fn().mockReturnValue(chain([])) };
    const trackingService = { listOnlineRiderIds: jest.fn().mockResolvedValue(['r1', 'r2']) };
    const service = makeService({ orderModel, riderModel, zoneModel, trackingService });

    const alerts = await service.getOperationalAlerts();

    const idleAlert = alerts.find((a) => a.type === 'RIDER_IDLE_TOO_LONG');
    expect(idleAlert).toBeDefined();
    expect(idleAlert!.riderId).toBe('r1');
    expect(idleAlert!.minutesSince).toBeGreaterThanOrEqual(20);

    const rejectedAlert = alerts.find((a) => a.type === 'RIDER_REJECTED_MULTIPLE');
    expect(rejectedAlert).toBeDefined();
    expect(rejectedAlert!.riderId).toBe('r2');

    // r1 has a fresh lastSeenAt-independent reject count of 1 -> below the
    // min-count threshold, so it must not also fire RIDER_REJECTED_MULTIPLE.
    expect(alerts.filter((a) => a.type === 'RIDER_REJECTED_MULTIPLE')).toHaveLength(1);
  });

  it('flags a zone with too few online riders for its active-order backlog and a zone with idle oversupply', async () => {
    const riders = [
      { _id: 'r1', assigned: false, zone: 'zone-1' },
      { _id: 'r2', assigned: false, zone: 'zone-1' },
      { _id: 'r3', assigned: true, zone: 'zone-1' },
      { _id: 'r4', assigned: false, zone: 'zone-2' },
      { _id: 'r5', assigned: false, zone: 'zone-2' },
      { _id: 'r6', assigned: false, zone: 'zone-2' },
      { _id: 'r7', assigned: false, zone: 'zone-2' },
    ];
    const zones = [
      { _id: 'zone-1', title: 'Centre' },
      { _id: 'zone-2', title: 'Nord' },
    ];
    const orderModel = {
      find: jest.fn().mockReturnValue(chain([])),
      aggregate: jest.fn().mockResolvedValue([{ _id: 'zone-1', count: 10 }]),
    };
    const riderModel = { find: jest.fn().mockReturnValue(chain(riders)) };
    const zoneModel = { find: jest.fn().mockReturnValue(chain(zones)) };
    const trackingService = {
      listOnlineRiderIds: jest.fn().mockResolvedValue(['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7']),
    };
    const service = makeService({ orderModel, riderModel, zoneModel, trackingService });

    const alerts = await service.getOperationalAlerts();

    // zone-1: 3 online riders, 10 active orders -> online(3) < ceil(10/3)=4
    const tooFew = alerts.find((a) => a.type === 'TOO_FEW_RIDERS_ONLINE');
    expect(tooFew).toBeDefined();
    expect(tooFew!.zoneId).toBe('zone-1');

    // zone-2: 4 idle online riders, 0 active orders -> oversupply
    const tooMany = alerts.find((a) => a.type === 'TOO_MANY_IDLE_RIDERS');
    expect(tooMany).toBeDefined();
    expect(tooMany!.zoneId).toBe('zone-2');
  });

  it('flags a SCHEDULED order close to its scheduled time and a city-wide dispatch EMERGENCY', async () => {
    const soon = new Date(Date.now() + 10 * 60_000).toISOString(); // 10 min from now
    const overdue = new Date(Date.now() - 5 * 60_000).toISOString(); // 5 min ago
    const scheduledOrders = [
      { _id: 'sched-1', orderId: 'ORD-SOON', scheduledFor: soon, restaurant: { _id: 'rest-1', name: 'Le Bistro' } },
      { _id: 'sched-2', orderId: 'ORD-LATE', scheduledFor: overdue, restaurant: { _id: 'rest-2', name: 'Chez Sam' } },
    ];
    // 15 unassigned PREPARED orders city-wide (no timing fields, so no
    // per-order NO_RIDER_ASSIGNED noise — isolates the city-wide alert).
    const unassignedPrepared = Array.from({ length: 15 }, (_, i) => ({
      _id: `order-${i}`,
      orderId: `ORD-${i}`,
      orderStatus: 'PREPARED',
      rider: null,
    }));
    const orderModel = {
      find: jest.fn().mockImplementation((filter: any) =>
        filter?.orderStatus === 'SCHEDULED' ? chain(scheduledOrders) : chain(unassignedPrepared),
      ),
      aggregate: jest.fn().mockResolvedValue([]),
    };
    const riderModel = { find: jest.fn().mockReturnValue(chain([])) };
    const zoneModel = { find: jest.fn().mockReturnValue(chain([])) };
    const trackingService = { listOnlineRiderIds: jest.fn().mockResolvedValue([]) };
    const service = makeService({ orderModel, riderModel, zoneModel, trackingService });

    const alerts = await service.getOperationalAlerts();

    const scheduledAlerts = alerts.filter((a) => a.type === 'SCHEDULED_ORDER_SOON');
    expect(scheduledAlerts).toHaveLength(2);
    const lateOne = scheduledAlerts.find((a) => a.orderDisplayId === 'ORD-LATE');
    expect(lateOne!.severity).toBe('HIGH'); // already overdue
    const soonOne = scheduledAlerts.find((a) => a.orderDisplayId === 'ORD-SOON');
    expect(soonOne!.severity).toBe('MEDIUM');

    const emergency = alerts.find((a) => a.type === 'CITYWIDE_DISPATCH_EMERGENCY');
    expect(emergency).toBeDefined();
    expect(emergency!.severity).toBe('EMERGENCY');
    // EMERGENCY must sort first (rank -1, ahead of CRITICAL/HIGH/MEDIUM/LOW).
    expect(alerts[0].severity).toBe('EMERGENCY');
  });
});
