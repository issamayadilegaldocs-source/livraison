import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument } from '../orders/order.schema';
import { Restaurant, RestaurantDocument } from '../restaurants/restaurant.schema';
import { Rider, RiderDocument } from '../riders/rider.schema';
import { Zone, ZoneDocument } from '../zones/zone.schema';
import { TrackingService } from '../tracking/tracking.service';
import {
  CrisisSnapshotModel,
  CrisisZoneSummaryModel,
  DispatchHotspotModel,
  DispatchHotspotType,
  LiveMapDataModel,
  OperationalAlertModel,
  OperationsOverviewModel,
  RiderOperationalProfileModel,
  ZoneOperationalStatsModel,
  ZoneOperationalStatus,
} from './operations.model';

const ACTIVE_STATUSES = [
  'PENDING',
  'ACCEPTED',
  'PREPARED',
  'AWAITING_RIDER',
  'ASSIGNED',
  'PICKED',
  'ARRIVED',
];
const IN_DELIVERY_STATUSES = ['ASSIGNED', 'PICKED', 'ARRIVED'];
const CANCELLED_STATUSES = ['CANCELLED', 'CANCELLEDBYREST'];

// zoneOperationalStats' avgDeliveryMinutes uses a rolling window (not
// "today") so the metric reflects current conditions rather than being
// flattened by the morning rush once the afternoon lull sets in.
const ZONE_STATS_RECENT_WINDOW_MINUTES = 180;

// dispatchHotspots: a zone only surfaces as a HIGH_DEMAND hotspot (absent a
// saturation/no-rider signal) once it has this many concurrent active orders.
const HOTSPOT_HIGH_DEMAND_MIN_ORDERS = 8;
// A restaurant surfaces as a SLOW_RESTAURANT hotspot once at least this many
// of its orders have sat in ACCEPTED (prepping) past ALERT_THRESHOLDS.preparingHigh.
const HOTSPOT_SLOW_RESTAURANT_MIN_ORDERS = 2;

// crisisSnapshot: a zone counts toward `ridersShortCount` once it has at
// least this many active orders and online riders can't cover roughly one
// rider per CRISIS_RIDERS_SHORT_ORDERS_PER_RIDER concurrent orders.
const CRISIS_RIDERS_SHORT_MIN_ORDERS = 3;
const CRISIS_RIDERS_SHORT_ORDERS_PER_RIDER = 3;
// City-wide unassigned-order count above which crisisSnapshot flags an
// emergency even absent an EMERGENCY-severity alert.
const CRISIS_CITYWIDE_UNASSIGNED_EMERGENCY = 15;

// Alert thresholds in minutes. Escalation cron uses 10 min for unassigned
// orders (ordersNeedingAttention); these stay aligned with that baseline.
const ALERT_THRESHOLDS = {
  pendingWarn: 5,
  pendingCritical: 10,
  preparingWarn: 25,
  preparingHigh: 40,
  awaitingRiderWarn: 8,
  awaitingRiderCritical: 15,
  pickupWarn: 15,
  pickupHigh: 25,
  lateWarn: 5,
  lateCritical: 20,
  // Alerts v2 — rider/zone/city-wide thresholds.
  //
  // A rider still flagged online (per listOnlineRiderIds' generous fallback
  // window) but whose last GPS heartbeat is this stale, while available and
  // unassigned, likely has a stuck/backgrounded app rather than a real
  // presence.
  riderIdleStaleMinutes: 12,
  // "Several rejections" is approximated from the lifetime cumulative
  // rejectedAssignmentsCount counter (there is no timestamped per-rejection
  // log yet — see this codebase's rider.schema.ts comment). Combined with an
  // acceptance-rate ceiling so the alert naturally clears as a rider's ratio
  // improves, rather than firing forever once a veteran rider crosses the
  // absolute count once.
  riderRejectedMultipleMinCount: 3,
  riderRejectedMultipleMaxAcceptanceRatePct: 50,
  // A SCHEDULED order this close to its scheduledFor time and still unassigned.
  scheduledSoonMinutes: 30,
  // Zone-level supply/demand mismatch: only worth flagging once there's a
  // meaningful backlog (avoids noise from a single order in a quiet zone,
  // already covered by the per-order NO_RIDER_ASSIGNED alert).
  tooFewRidersMinActiveOrders: 3,
  tooFewRidersOrdersPerRider: 3,
  tooManyIdleMinCount: 4,
  tooManyIdleRatio: 3,
  // City-wide unassigned-order count (PREPARED, no rider) above which an
  // EMERGENCY alert fires even absent any single order past its own threshold.
  cityWideUnassignedEmergency: 15,
};

type SeverityRank = Record<string, number>;
const SEVERITY_RANK: SeverityRank = { EMERGENCY: -1, CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

/**
 * Read-side aggregations for the admin Operations Control Center. Lives in the
 * dashboard module (the established cross-domain reporting boundary); rider
 * presence is delegated to TrackingService, which owns the Redis keys.
 */
@Injectable()
export class OperationsService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Restaurant.name)
    private readonly restaurantModel: Model<RestaurantDocument>,
    @InjectModel(Rider.name) private readonly riderModel: Model<RiderDocument>,
    @InjectModel(Zone.name) private readonly zoneModel: Model<ZoneDocument>,
    private readonly trackingService: TrackingService,
  ) {}

  // ── overview ──────────────────────────────────────────────────────────────

  async getOperationsOverview(): Promise<OperationsOverviewModel> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart.getTime() - ((todayStart.getDay() + 6) % 7) * 86_400_000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const todayIso = todayStart.toISOString();
    const nowIso = now.toISOString();

    const [
      todayByStatus,
      activeByStatus,
      lateActiveCount,
      deliveredToday,
      cancelledToday,
      lateDeliveredToday,
      timings,
      revenue,
      totalRiders,
      assignedRiderIds,
      onlineRiderIds,
      totalStores,
      openStores,
      preparingRestaurantIds,
    ] = await Promise.all([
      this.orderModel.aggregate([
        { $match: { createdAt: { $gte: todayStart } } },
        { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
      ]),
      this.orderModel.aggregate([
        { $match: { orderStatus: { $in: ACTIVE_STATUSES } } },
        { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
      ]),
      this.orderModel.countDocuments({
        orderStatus: { $in: ACTIVE_STATUSES },
        expectedTime: { $nin: [null, ''], $lt: nowIso },
      }),
      this.orderModel.countDocuments({
        orderStatus: 'DELIVERED',
        deliveredAt: { $gte: todayIso },
      }),
      this.orderModel.countDocuments({
        orderStatus: { $in: CANCELLED_STATUSES },
        cancelledAt: { $gte: todayIso },
      }),
      this.orderModel.countDocuments({
        orderStatus: 'DELIVERED',
        deliveredAt: { $gte: todayIso },
        expectedTime: { $nin: [null, ''] },
        $expr: { $gt: ['$deliveredAt', '$expectedTime'] },
      }),
      this.computeTimingAverages(todayStart),
      this.computeRevenue(todayStart, weekStart, monthStart),
      this.riderModel.countDocuments({ isActive: true }),
      this.riderModel.find({ isActive: true, assigned: true }, '_id').lean().exec(),
      this.trackingService.listOnlineRiderIds(),
      this.restaurantModel.countDocuments({ isActive: true }),
      this.restaurantModel.countDocuments({ isActive: true, isAvailable: true }),
      this.orderModel.distinct('restaurant', { orderStatus: 'ACCEPTED' }),
    ]);

    const countOf = (rows: Array<{ _id: string; count: number }>, statuses: string[]) =>
      rows.filter((r) => statuses.includes(r._id)).reduce((sum, r) => sum + r.count, 0);

    const onlineSet = new Set(onlineRiderIds);
    const busyOnline = assignedRiderIds.filter((r) => onlineSet.has(String(r._id))).length;
    const onlineRiders = onlineRiderIds.length;

    const totalToday = todayByStatus.reduce((sum, r) => sum + r.count, 0);
    const finishedToday = deliveredToday + cancelledToday;

    return {
      generatedAt: nowIso,
      orders: {
        totalToday,
        pendingCount: countOf(activeByStatus, ['PENDING']),
        preparingCount: countOf(activeByStatus, ['ACCEPTED']),
        awaitingRiderCount: countOf(activeByStatus, ['PREPARED', 'AWAITING_RIDER']),
        inDeliveryCount: countOf(activeByStatus, IN_DELIVERY_STATUSES),
        deliveredToday,
        cancelledToday,
        lateActiveCount,
      },
      timings,
      revenue,
      fleet: {
        totalRiders,
        onlineRiders,
        busyRiders: busyOnline,
        idleRiders: Math.max(0, onlineRiders - busyOnline),
        offlineRiders: Math.max(0, totalRiders - onlineRiders),
      },
      stores: {
        totalStores,
        openStores,
        closedStores: Math.max(0, totalStores - openStores),
        preparingStores: preparingRestaurantIds.length,
      },
      quality: {
        successRatePct: finishedToday ? this.round((deliveredToday / finishedToday) * 100) : 100,
        cancellationRatePct: totalToday ? this.round((cancelledToday / totalToday) * 100) : 0,
        lateDeliveriesToday: lateDeliveredToday,
      },
    };
  }

  /**
   * Averages over orders delivered today. Lifecycle timestamps are stored as
   * ISO strings, so each is converted with a null fallback and pairs are only
   * measured when both ends exist.
   */
  private async computeTimingAverages(todayStart: Date) {
    const [row] = await this.orderModel.aggregate([
      {
        $match: {
          orderStatus: 'DELIVERED',
          deliveredAt: { $gte: todayStart.toISOString() },
        },
      },
      {
        $project: {
          accepted: { $convert: { input: '$acceptedAt', to: 'date', onError: null, onNull: null } },
          prepared: { $convert: { input: '$preparedAt', to: 'date', onError: null, onNull: null } },
          picked: { $convert: { input: '$pickedAt', to: 'date', onError: null, onNull: null } },
          delivered: {
            $convert: { input: '$deliveredAt', to: 'date', onError: null, onNull: null },
          },
          created: '$createdAt',
        },
      },
      {
        $project: {
          prepMin: this.diffMinutes('$prepared', '$accepted'),
          deliveryMin: this.diffMinutes('$delivered', '$picked'),
          riderWaitMin: this.diffMinutes('$picked', '$prepared'),
          customerWaitMin: this.diffMinutes('$delivered', '$created'),
        },
      },
      {
        $group: {
          _id: null,
          avgPreparationMinutes: { $avg: '$prepMin' },
          avgDeliveryMinutes: { $avg: '$deliveryMin' },
          avgRiderWaitMinutes: { $avg: '$riderWaitMin' },
          avgCustomerWaitMinutes: { $avg: '$customerWaitMin' },
        },
      },
    ]);
    return {
      avgPreparationMinutes: this.roundOrNull(row?.avgPreparationMinutes),
      avgDeliveryMinutes: this.roundOrNull(row?.avgDeliveryMinutes),
      avgRiderWaitMinutes: this.roundOrNull(row?.avgRiderWaitMinutes),
      avgCustomerWaitMinutes: this.roundOrNull(row?.avgCustomerWaitMinutes),
    };
  }

  /** Sums of orderAmount over non-cancelled orders since week/month start. */
  private async computeRevenue(todayStart: Date, weekStart: Date, monthStart: Date) {
    // The week can start in the previous month, so match from the earlier of
    // the two range starts and bucket with $cond below.
    const rangeStart = weekStart < monthStart ? weekStart : monthStart;
    const [row] = await this.orderModel.aggregate([
      {
        $match: {
          createdAt: { $gte: rangeStart },
          orderStatus: { $nin: CANCELLED_STATUSES },
        },
      },
      {
        $group: {
          _id: null,
          thisMonth: {
            $sum: { $cond: [{ $gte: ['$createdAt', monthStart] }, '$orderAmount', 0] },
          },
          thisWeek: {
            $sum: { $cond: [{ $gte: ['$createdAt', weekStart] }, '$orderAmount', 0] },
          },
          today: {
            $sum: { $cond: [{ $gte: ['$createdAt', todayStart] }, '$orderAmount', 0] },
          },
        },
      },
    ]);
    return {
      today: this.round(row?.today ?? 0),
      thisWeek: this.round(row?.thisWeek ?? 0),
      thisMonth: this.round(row?.thisMonth ?? 0),
    };
  }


  // ── rider operational profile (rider detail drawer) ─────────────────────────

  /**
   * Cross-domain read composed for the admin rider detail drawer: Rider
   * document fields plus derived performance signals from today's Orders.
   * Lives in the operations read-model layer (not the riders module) because
   * it needs Order data — see this module's file header convention.
   */
  async getRiderOperationalProfile(riderId: string): Promise<RiderOperationalProfileModel> {
    const riderObjectId = this.toObjectId(riderId, 'Rider');
    const rider = await this.riderModel
      .findById(riderObjectId, {
        name: 1,
        phone: 1,
        vehicleType: 1,
        vehicleDetails: 1,
        available: 1,
        assigned: 1,
        acceptedAssignmentsCount: 1,
        rejectedAssignmentsCount: 1,
        currentWalletAmount: 1,
        lastSeenAt: 1,
        zone: 1,
      })
      .populate({ path: 'zone', select: '_id title' })
      .lean()
      .exec();
    if (!rider) throw new NotFoundException(`Rider ${riderId} not found`);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayIso = todayStart.toISOString();

    const [onlineRiderIds, deliveredTodayOrders] = await Promise.all([
      this.trackingService.listOnlineRiderIds(),
      this.orderModel
        .find(
          { rider: riderObjectId, orderStatus: 'DELIVERED', deliveredAt: { $gte: todayIso } },
          'orderAmount orderAmountMinor paymentMethod codCollectedAt expectedTime deliveredAt',
        )
        .lean()
        .exec(),
    ]);

    const accepted = (rider as any).acceptedAssignmentsCount ?? 0;
    const rejected = (rider as any).rejectedAssignmentsCount ?? 0;
    const totalAssignments = accepted + rejected;
    const acceptanceRatePct = totalAssignments > 0 ? this.round((accepted / totalAssignments) * 100) : undefined;

    let cashCollectedTodayMinor = 0;
    let onTimeCount = 0;
    let timedCount = 0;
    for (const order of deliveredTodayOrders as any[]) {
      if (order.paymentMethod === 'COD' && order.codCollectedAt) {
        cashCollectedTodayMinor += order.orderAmountMinor ?? Math.round((order.orderAmount ?? 0) * 100);
      }
      if (order.expectedTime && order.deliveredAt) {
        timedCount += 1;
        if (order.deliveredAt <= order.expectedTime) onTimeCount += 1;
      }
    }
    const onTimeRatePct = timedCount > 0 ? this.round((onTimeCount / timedCount) * 100) : undefined;

    return {
      riderId,
      name: (rider as any).name,
      phone: (rider as any).phone,
      vehicleType: (rider as any).vehicleType,
      licensePlate: (rider as any).vehicleDetails?.number,
      online: onlineRiderIds.includes(riderId),
      available: Boolean((rider as any).available),
      busy: Boolean((rider as any).assigned),
      acceptedAssignmentsCount: accepted,
      rejectedAssignmentsCount: rejected,
      acceptanceRatePct,
      deliveriesTodayCount: deliveredTodayOrders.length,
      cashCollectedTodayMinor,
      onTimeRatePct,
      currentWalletAmount: (rider as any).currentWalletAmount,
      lastSeenAt: (rider as any).lastSeenAt ? new Date((rider as any).lastSeenAt).toISOString() : undefined,
      zoneId: (rider as any).zone?._id ? String((rider as any).zone._id) : undefined,
      zoneTitle: (rider as any).zone?.title,
    };
  }

  // ── zone operational stats ───────────────────────────────────────────────────

  /**
   * Per-zone rider/order/store snapshot for the ops map's zone overlay.
   * `saturationScore`/`status` are a documented heuristic (order-load per
   * online rider + lateness ratio), not a precise SLA computation.
   */
  async getZoneOperationalStats(): Promise<ZoneOperationalStatsModel[]> {
    const now = new Date();
    const nowIso = now.toISOString();
    const recentWindowIso = new Date(now.getTime() - ZONE_STATS_RECENT_WINDOW_MINUTES * 60_000).toISOString();

    const [zones, riders, onlineRiderIds, activeByZoneRows, openStoresByZoneRows, deliveryTimingRows, lateByZoneRows] =
      await Promise.all([
        this.zoneModel.find({ isActive: true }, '_id title').lean().exec(),
        this.riderModel.find({ isActive: true }, '_id zone assigned').lean().exec(),
        this.trackingService.listOnlineRiderIds(),
        this.orderModel.aggregate([
          { $match: { orderStatus: { $in: ACTIVE_STATUSES }, zone: { $ne: null } } },
          { $group: { _id: '$zone', count: { $sum: 1 } } },
        ]),
        this.restaurantModel.aggregate([
          { $match: { isActive: true, isAvailable: true, zone: { $ne: null } } },
          { $group: { _id: '$zone', count: { $sum: 1 } } },
        ]),
        this.orderModel.aggregate([
          {
            $match: {
              orderStatus: 'DELIVERED',
              zone: { $ne: null },
              deliveredAt: { $gte: recentWindowIso },
            },
          },
          {
            $project: {
              zone: 1,
              picked: { $convert: { input: '$pickedAt', to: 'date', onError: null, onNull: null } },
              delivered: { $convert: { input: '$deliveredAt', to: 'date', onError: null, onNull: null } },
            },
          },
          {
            $group: {
              _id: '$zone',
              avgDeliveryMinutes: { $avg: this.diffMinutes('$delivered', '$picked') },
            },
          },
        ]),
        this.orderModel.aggregate([
          {
            $match: {
              orderStatus: { $in: ACTIVE_STATUSES },
              zone: { $ne: null },
              expectedTime: { $nin: [null, ''], $lt: nowIso },
            },
          },
          { $group: { _id: '$zone', count: { $sum: 1 } } },
        ]),
      ]);

    const onlineSet = new Set(onlineRiderIds);
    const onlineByZone = new Map<string, number>();
    const busyByZone = new Map<string, number>();
    for (const rider of riders as any[]) {
      if (!rider.zone) continue;
      const zoneId = String(rider.zone);
      if (!onlineSet.has(String(rider._id))) continue;
      onlineByZone.set(zoneId, (onlineByZone.get(zoneId) ?? 0) + 1);
      if (rider.assigned) busyByZone.set(zoneId, (busyByZone.get(zoneId) ?? 0) + 1);
    }

    const toCountMap = (rows: Array<{ _id: unknown; count: number }>) =>
      new Map(rows.map((r) => [String(r._id), r.count]));
    const activeMap = toCountMap(activeByZoneRows);
    const openStoresMap = toCountMap(openStoresByZoneRows);
    const lateMap = toCountMap(lateByZoneRows);
    const avgDeliveryMap = new Map<string, number | undefined>(
      (deliveryTimingRows as any[]).map((r) => [String(r._id), this.roundOrNull(r.avgDeliveryMinutes)]),
    );

    return (zones as any[]).map((zone) => {
      const zoneId = String(zone._id);
      const online = onlineByZone.get(zoneId) ?? 0;
      const busy = Math.min(online, busyByZone.get(zoneId) ?? 0);
      const idle = Math.max(0, online - busy);
      const activeOrdersCount = activeMap.get(zoneId) ?? 0;
      const lateCount = lateMap.get(zoneId) ?? 0;

      // Load component: orders per online rider, capped at 4x (0-70 pts).
      // Zero online riders with active orders in the zone maxes it out.
      const loadRatio = online > 0 ? activeOrdersCount / online : activeOrdersCount > 0 ? 4 : 0;
      // Lateness component: share of active orders already past expectedTime (0-30 pts).
      const lateRatio = activeOrdersCount > 0 ? lateCount / activeOrdersCount : 0;
      const saturationScore = Math.max(
        0,
        Math.min(100, Math.round(Math.min(loadRatio, 4) * 17.5 + lateRatio * 30)),
      );

      let status: ZoneOperationalStatus;
      if (saturationScore >= 85) status = ZoneOperationalStatus.CRITICAL;
      else if (saturationScore >= 60) status = ZoneOperationalStatus.SATURATED;
      else if (saturationScore >= 30) status = ZoneOperationalStatus.BUSY;
      else status = ZoneOperationalStatus.HEALTHY;

      return {
        zoneId,
        zoneTitle: zone.title,
        riderCount: { online, busy, idle },
        activeOrdersCount,
        openStoresCount: openStoresMap.get(zoneId) ?? 0,
        avgDeliveryMinutes: avgDeliveryMap.get(zoneId),
        lateCount,
        saturationScore,
        status,
      };
    });
  }

  // ── dispatch hotspots ─────────────────────────────────────────────────────────

  /**
   * Buckets active/unassigned orders geographically for the ops map's hotspot
   * overlay. Zone-bucket granularity (zone polygon centroid), not real
   * clustering — sufficient for a dispatcher-facing heatmap. Accepts an
   * optional pre-computed `zoneStats` so `crisisSnapshot` can reuse one pass
   * instead of recomputing zone aggregates twice in the same round trip.
   */
  async getDispatchHotspots(
    precomputedZoneStats?: ZoneOperationalStatsModel[],
  ): Promise<DispatchHotspotModel[]> {
    const [zoneStats, zoneGeometries] = await Promise.all([
      precomputedZoneStats ?? this.getZoneOperationalStats(),
      this.zoneModel.find({ isActive: true }, '_id location').lean().exec(),
    ]);
    const geometryByZone = new Map(
      (zoneGeometries as any[]).map((z) => [String(z._id), z.location?.coordinates]),
    );

    const hotspots: DispatchHotspotModel[] = [];
    for (const stats of zoneStats) {
      const centroid = this.polygonCentroid(geometryByZone.get(stats.zoneId));
      if (!centroid) continue;

      let type: DispatchHotspotType | null = null;
      if (stats.riderCount.online === 0 && stats.activeOrdersCount > 0) {
        type = DispatchHotspotType.NO_RIDER;
      } else if (
        stats.status === ZoneOperationalStatus.CRITICAL ||
        stats.status === ZoneOperationalStatus.SATURATED
      ) {
        type = DispatchHotspotType.SATURATED_ZONE;
      } else if (stats.activeOrdersCount >= HOTSPOT_HIGH_DEMAND_MIN_ORDERS) {
        type = DispatchHotspotType.HIGH_DEMAND;
      }
      if (!type) continue;

      hotspots.push({
        latitude: centroid.lat,
        longitude: centroid.lng,
        radiusMeters: Math.min(3000, 400 + stats.activeOrdersCount * 150),
        orderCount: stats.activeOrdersCount,
        type,
        zoneId: stats.zoneId,
        zoneTitle: stats.zoneTitle,
        label: `${stats.zoneTitle}: ${stats.activeOrdersCount} commande(s) active(s)`,
      });
    }

    // Restaurant-level: orders stuck prepping (ACCEPTED) past the same
    // threshold the PREPARING_TOO_LONG/HIGH alert already uses.
    const slowCutoffIso = new Date(Date.now() - ALERT_THRESHOLDS.preparingHigh * 60_000).toISOString();
    const slowRows = await this.orderModel.aggregate([
      { $match: { orderStatus: 'ACCEPTED', acceptedAt: { $ne: null, $lte: slowCutoffIso } } },
      { $group: { _id: '$restaurant', count: { $sum: 1 } } },
      { $match: { count: { $gte: HOTSPOT_SLOW_RESTAURANT_MIN_ORDERS } } },
    ]);
    if (slowRows.length) {
      const restaurants = await this.restaurantModel
        .find({ _id: { $in: slowRows.map((r: any) => r._id) } }, '_id name location zone')
        .lean()
        .exec();
      const restaurantById = new Map((restaurants as any[]).map((r) => [String(r._id), r]));
      for (const row of slowRows as any[]) {
        const restaurant = restaurantById.get(String(row._id));
        const coords = restaurant?.location?.coordinates;
        if (!coords) continue;
        hotspots.push({
          latitude: coords[1],
          longitude: coords[0],
          radiusMeters: 300,
          orderCount: row.count,
          type: DispatchHotspotType.SLOW_RESTAURANT,
          zoneId: restaurant.zone ? String(restaurant.zone) : undefined,
          label: `${restaurant.name}: ${row.count} commande(s) en préparation prolongée`,
        });
      }
    }

    return hotspots;
  }

  /** Simple vertex-average centroid of a Polygon's outer ring — adequate for
   * a heatmap circle, not meant to be a precise geometric centroid. */
  private polygonCentroid(coordinates?: number[][][]): { lat: number; lng: number } | null {
    const ring = coordinates?.[0];
    if (!ring?.length) return null;
    let sumLng = 0;
    let sumLat = 0;
    let count = 0;
    for (const point of ring) {
      if (!Array.isArray(point) || point.length < 2) continue;
      sumLng += point[0];
      sumLat += point[1];
      count += 1;
    }
    if (!count) return null;
    return { lat: sumLat / count, lng: sumLng / count };
  }

  // ── crisis snapshot ───────────────────────────────────────────────────────────

  /**
   * Composes overview + zone stats + hotspots + alerts into one round trip
   * for the crisis-mode dashboard view. Reuses the same zoneStats pass for
   * both the saturated-zone summary and dispatchHotspots.
   */
  async getCrisisSnapshot(): Promise<CrisisSnapshotModel> {
    const [overview, zoneStats] = await Promise.all([
      this.getOperationsOverview(),
      this.getZoneOperationalStats(),
    ]);
    const [hotspots, alerts, unassignedOrdersCount] = await Promise.all([
      this.getDispatchHotspots(zoneStats),
      this.getOperationalAlerts(200),
      this.orderModel.countDocuments({ orderStatus: 'PREPARED', rider: null }).exec(),
    ]);

    const saturatedZones: CrisisZoneSummaryModel[] = zoneStats
      .filter(
        (z) => z.status === ZoneOperationalStatus.SATURATED || z.status === ZoneOperationalStatus.CRITICAL,
      )
      .map((z) => ({
        zoneId: z.zoneId,
        zoneTitle: z.zoneTitle,
        status: z.status,
        activeOrdersCount: z.activeOrdersCount,
        onlineRiderCount: z.riderCount.online,
      }))
      .sort((a, b) => b.activeOrdersCount - a.activeOrdersCount);

    // "Riders well short of demand": at least a handful of active orders in
    // the zone, with online riders below one per CRISIS_RIDERS_SHORT_ORDERS_PER_RIDER.
    const ridersShortCount = zoneStats.filter(
      (z) =>
        z.activeOrdersCount >= CRISIS_RIDERS_SHORT_MIN_ORDERS &&
        z.riderCount.online < Math.ceil(z.activeOrdersCount / CRISIS_RIDERS_SHORT_ORDERS_PER_RIDER),
    ).length;

    const restaurantsOverwhelmedCount = hotspots.filter(
      (h) => h.type === DispatchHotspotType.SLOW_RESTAURANT,
    ).length;

    const emergencyAlerts = alerts.filter((a) => a.severity === 'EMERGENCY');
    const isEmergency =
      emergencyAlerts.length > 0 || unassignedOrdersCount >= CRISIS_CITYWIDE_UNASSIGNED_EMERGENCY;

    const topProblems: string[] = [];
    for (const zone of saturatedZones.slice(0, 5)) {
      topProblems.push(
        `Zone ${zone.zoneTitle}: ${zone.activeOrdersCount} commande(s) active(s), ${zone.onlineRiderCount} livreur(s) en ligne`,
      );
    }
    if (unassignedOrdersCount > 0) {
      topProblems.push(`${unassignedOrdersCount} commande(s) non assignée(s) à l'échelle de la ville`);
    }
    for (const alert of emergencyAlerts.slice(0, 3)) {
      topProblems.push(`${alert.type}: ${alert.suggestedAction}`);
    }

    return {
      generatedAt: new Date().toISOString(),
      pendingOrdersCount: overview.orders.pendingCount,
      unassignedOrdersCount,
      saturatedZones,
      ridersShortCount,
      restaurantsOverwhelmedCount,
      topProblems: topProblems.length ? topProblems : ['Aucun problème critique détecté'],
      isEmergency,
    };
  }

  // ── live map ──────────────────────────────────────────────────────────────

  async getLiveMapData(): Promise<LiveMapDataModel> {
    const [riders, onlineRiderIds, riderOrders, stores, activePerStore] = await Promise.all([
      this.riderModel
        .find({ isActive: true }, 'name phone vehicleType available assigned lastKnownLocation lastSeenAt')
        .lean()
        .exec(),
      this.trackingService.listOnlineRiderIds(),
      this.orderModel
        .find(
          { orderStatus: { $in: IN_DELIVERY_STATUSES }, rider: { $ne: null } },
          '_id orderId orderStatus rider',
        )
        .lean()
        .exec(),
      this.restaurantModel
        .find({ isActive: true }, 'name isAvailable location')
        .lean()
        .exec(),
      this.orderModel.aggregate([
        { $match: { orderStatus: { $in: ACTIVE_STATUSES } } },
        { $group: { _id: '$restaurant', count: { $sum: 1 } } },
      ]),
    ]);

    const onlineSet = new Set(onlineRiderIds);
    const orderByRider = new Map<string, { _id: string; orderId?: string; orderStatus?: string }>();
    for (const order of riderOrders as any[]) {
      orderByRider.set(String(order.rider), {
        _id: String(order._id),
        orderId: order.orderId,
        orderStatus: order.orderStatus,
      });
    }
    const activeCountByStore = new Map<string, number>(
      activePerStore.map((r: any) => [String(r._id), r.count]),
    );

    return {
      generatedAt: new Date().toISOString(),
      riders: (riders as any[]).map((rider) => {
        const id = String(rider._id);
        const coords: number[] | undefined = rider.lastKnownLocation?.coordinates;
        const current = orderByRider.get(id);
        return {
          _id: id,
          name: rider.name,
          phone: rider.phone,
          vehicleType: rider.vehicleType,
          online: onlineSet.has(id),
          available: Boolean(rider.available),
          busy: Boolean(rider.assigned),
          longitude: coords?.[0],
          latitude: coords?.[1],
          lastSeenAt: rider.lastSeenAt ? new Date(rider.lastSeenAt).toISOString() : undefined,
          currentOrderId: current?._id,
          currentOrderDisplayId: current?.orderId,
          currentOrderStatus: current?.orderStatus,
        };
      }),
      stores: (stores as any[]).map((store) => {
        const coords: number[] | undefined = store.location?.coordinates;
        return {
          _id: String(store._id),
          name: store.name,
          open: Boolean(store.isAvailable),
          longitude: coords?.[0],
          latitude: coords?.[1],
          activeOrdersCount: activeCountByStore.get(String(store._id)) ?? 0,
        };
      }),
    };
  }

  // ── alert center ──────────────────────────────────────────────────────────

  async getOperationalAlerts(limit = 100): Promise<OperationalAlertModel[]> {
    const [orders, onlineRiderIds, riders, zones, scheduledOrders, activeOrdersByZoneRows] =
      await Promise.all([
        this.orderModel
          .find({ orderStatus: { $in: ACTIVE_STATUSES } })
          .select(
            'orderId orderStatus createdAt acceptedAt preparedAt assignedAt pickedAt expectedTime restaurant rider user',
          )
          .populate({ path: 'restaurant', select: '_id name' })
          .populate({ path: 'rider', select: '_id name' })
          .populate({ path: 'user', select: '_id name' })
          .lean()
          .exec(),
        this.trackingService.listOnlineRiderIds(),
        this.riderModel
          .find(
            { isActive: true },
            '_id name available assigned lastSeenAt zone acceptedAssignmentsCount rejectedAssignmentsCount',
          )
          .lean()
          .exec(),
        this.zoneModel.find({ isActive: true }, '_id title').lean().exec(),
        this.orderModel
          .find(
            { orderStatus: 'SCHEDULED', scheduledFor: { $ne: null } },
            'orderId scheduledFor restaurant',
          )
          .populate({ path: 'restaurant', select: '_id name' })
          .lean()
          .exec(),
        this.orderModel.aggregate([
          { $match: { orderStatus: { $in: ACTIVE_STATUSES }, zone: { $ne: null } } },
          { $group: { _id: '$zone', count: { $sum: 1 } } },
        ]),
      ]);

    const now = Date.now();
    const onlineSet = new Set(onlineRiderIds);
    const alerts: OperationalAlertModel[] = [];
    const T = ALERT_THRESHOLDS;
    const zoneTitleById = new Map((zones as any[]).map((z) => [String(z._id), z.title]));

    const minutesSince = (value?: string | Date): number | null => {
      if (!value) return null;
      const ts = new Date(value).getTime();
      if (!Number.isFinite(ts)) return null;
      return Math.floor((now - ts) / 60_000);
    };

    let cityWideUnassignedCount = 0;

    for (const order of orders as any[]) {
      if (order.orderStatus === 'PREPARED' && !order.rider) cityWideUnassignedCount += 1;

      const base = {
        orderId: String(order._id),
        orderDisplayId: order.orderId,
        orderStatus: order.orderStatus,
        restaurantName: order.restaurant?.name,
        restaurantId: order.restaurant?._id ? String(order.restaurant._id) : undefined,
        riderName: order.rider?.name,
        riderId: order.rider?._id ? String(order.rider._id) : undefined,
        customerName: order.user?.name,
      };
      const push = (type: string, severity: string, mins: number, suggestedAction: string) =>
        alerts.push({
          id: `${base.orderId}:${type}`,
          type,
          severity,
          minutesSince: mins,
          suggestedAction,
          ...base,
        });

      const status = order.orderStatus as string;

      if (status === 'PENDING') {
        const mins = minutesSince(order.createdAt);
        if (mins !== null && mins >= T.pendingWarn) {
          push(
            'STORE_NOT_ACCEPTING',
            mins >= T.pendingCritical ? 'CRITICAL' : 'HIGH',
            mins,
            'CALL_STORE',
          );
        }
      } else if (status === 'ACCEPTED') {
        const mins = minutesSince(order.acceptedAt ?? order.createdAt);
        if (mins !== null && mins >= T.preparingWarn) {
          push('PREPARING_TOO_LONG', mins >= T.preparingHigh ? 'HIGH' : 'MEDIUM', mins, 'CALL_STORE');
        }
      } else if (status === 'PREPARED' || status === 'AWAITING_RIDER') {
        const mins = minutesSince(order.preparedAt ?? order.acceptedAt ?? order.createdAt);
        if (mins !== null && mins >= T.awaitingRiderWarn) {
          push(
            'NO_RIDER_ASSIGNED',
            mins >= T.awaitingRiderCritical ? 'CRITICAL' : 'HIGH',
            mins,
            'ASSIGN_RIDER_MANUALLY',
          );
        }
      } else if (status === 'ASSIGNED') {
        const mins = minutesSince(order.assignedAt ?? order.preparedAt);
        if (mins !== null && mins >= T.pickupWarn) {
          push('PICKUP_DELAYED', mins >= T.pickupHigh ? 'HIGH' : 'MEDIUM', mins, 'CONTACT_RIDER');
        }
      }

      if (IN_DELIVERY_STATUSES.includes(status)) {
        if (order.expectedTime) {
          const late = minutesSince(order.expectedTime);
          if (late !== null && late >= T.lateWarn) {
            push(
              'DELIVERY_LATE',
              late >= T.lateCritical ? 'CRITICAL' : 'HIGH',
              late,
              'CONTACT_RIDER',
            );
          }
        }
        if (base.riderId && !onlineSet.has(base.riderId)) {
          const mins = minutesSince(order.assignedAt) ?? 0;
          push('RIDER_GPS_LOST', 'MEDIUM', mins, 'CONTACT_RIDER');
        }
      }
    }

    // ── rider-level alerts ────────────────────────────────────────────────
    const onlineByZone = new Map<string, number>();
    const idleOnlineByZone = new Map<string, number>();
    for (const rider of riders as any[]) {
      const riderId = String(rider._id);
      const online = onlineSet.has(riderId);
      const zoneId = rider.zone ? String(rider.zone) : undefined;
      if (online && zoneId) {
        onlineByZone.set(zoneId, (onlineByZone.get(zoneId) ?? 0) + 1);
        if (!rider.assigned) idleOnlineByZone.set(zoneId, (idleOnlineByZone.get(zoneId) ?? 0) + 1);
      }

      if (online && rider.available && !rider.assigned) {
        const idleMins = minutesSince(rider.lastSeenAt);
        if (idleMins !== null && idleMins >= T.riderIdleStaleMinutes) {
          alerts.push({
            id: `${riderId}:RIDER_IDLE_TOO_LONG`,
            type: 'RIDER_IDLE_TOO_LONG',
            severity: 'MEDIUM',
            riderId,
            riderName: rider.name,
            zoneId,
            zoneTitle: zoneId ? zoneTitleById.get(zoneId) : undefined,
            minutesSince: idleMins,
            suggestedAction: 'CHECK_RIDER_STATUS',
          });
        }
      }

      const accepted = rider.acceptedAssignmentsCount ?? 0;
      const rejected = rider.rejectedAssignmentsCount ?? 0;
      const total = accepted + rejected;
      const acceptanceRatePct = total > 0 ? (accepted / total) * 100 : undefined;
      if (
        rejected >= T.riderRejectedMultipleMinCount &&
        acceptanceRatePct !== undefined &&
        acceptanceRatePct < T.riderRejectedMultipleMaxAcceptanceRatePct
      ) {
        alerts.push({
          id: `${riderId}:RIDER_REJECTED_MULTIPLE`,
          type: 'RIDER_REJECTED_MULTIPLE',
          severity: 'MEDIUM',
          riderId,
          riderName: rider.name,
          zoneId,
          zoneTitle: zoneId ? zoneTitleById.get(zoneId) : undefined,
          minutesSince: 0,
          suggestedAction: 'REVIEW_RIDER_RELIABILITY',
        });
      }
    }

    // ── zone-level alerts ─────────────────────────────────────────────────
    const activeOrdersByZone = new Map<string, number>(
      (activeOrdersByZoneRows as any[]).map((row) => [String(row._id), row.count]),
    );

    for (const zone of zones as any[]) {
      const zoneId = String(zone._id);
      const activeCount = activeOrdersByZone.get(zoneId) ?? 0;
      const online = onlineByZone.get(zoneId) ?? 0;
      const idle = idleOnlineByZone.get(zoneId) ?? 0;

      if (
        activeCount >= T.tooFewRidersMinActiveOrders &&
        online < Math.ceil(activeCount / T.tooFewRidersOrdersPerRider)
      ) {
        alerts.push({
          id: `${zoneId}:TOO_FEW_RIDERS_ONLINE`,
          type: 'TOO_FEW_RIDERS_ONLINE',
          severity: 'HIGH',
          zoneId,
          zoneTitle: zone.title,
          minutesSince: 0,
          suggestedAction: 'REQUEST_MORE_RIDERS',
        });
      }

      if (idle >= T.tooManyIdleMinCount && idle > activeCount * T.tooManyIdleRatio) {
        alerts.push({
          id: `${zoneId}:TOO_MANY_IDLE_RIDERS`,
          type: 'TOO_MANY_IDLE_RIDERS',
          severity: 'LOW',
          zoneId,
          zoneTitle: zone.title,
          minutesSince: 0,
          suggestedAction: 'REBALANCE_RIDERS',
        });
      }
    }

    // ── scheduled-order alerts ────────────────────────────────────────────
    for (const order of scheduledOrders as any[]) {
      const minutesUntil = Math.floor((new Date(order.scheduledFor).getTime() - now) / 60_000);
      if (minutesUntil <= T.scheduledSoonMinutes) {
        alerts.push({
          id: `${String(order._id)}:SCHEDULED_ORDER_SOON`,
          type: 'SCHEDULED_ORDER_SOON',
          severity: minutesUntil <= 0 ? 'HIGH' : 'MEDIUM',
          orderId: String(order._id),
          orderDisplayId: order.orderId,
          restaurantName: order.restaurant?.name,
          restaurantId: order.restaurant?._id ? String(order.restaurant._id) : undefined,
          minutesSince: -minutesUntil,
          suggestedAction: 'CONFIRM_RIDER_AVAILABILITY',
        });
      }
    }

    // ── city-wide emergency ───────────────────────────────────────────────
    if (cityWideUnassignedCount >= T.cityWideUnassignedEmergency) {
      alerts.push({
        id: 'CITYWIDE:CITYWIDE_DISPATCH_EMERGENCY',
        type: 'CITYWIDE_DISPATCH_EMERGENCY',
        severity: 'EMERGENCY',
        minutesSince: 0,
        suggestedAction: 'ACTIVATE_CRISIS_MODE',
      });
    }

    alerts.sort((a, b) => {
      const rank = (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9);
      return rank !== 0 ? rank : b.minutesSince - a.minutesSince;
    });
    return alerts.slice(0, limit);
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  private diffMinutes(end: string, start: string) {
    return {
      $cond: [
        { $and: [{ $ne: [end, null] }, { $ne: [start, null] }] },
        { $divide: [{ $subtract: [end, start] }, 60_000] },
        null,
      ],
    };
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private roundOrNull(value?: number | null): number | undefined {
    return value === null || value === undefined ? undefined : this.round(value);
  }

  private toObjectId(value: string, label: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) throw new BadRequestException(`${label} id is invalid`);
    return new Types.ObjectId(value);
  }
}
