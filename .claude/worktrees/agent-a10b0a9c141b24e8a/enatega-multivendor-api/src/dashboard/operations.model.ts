import { Field, Float, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

// ── Operations overview (live control-center stats) ───────────────────────

@ObjectType('OperationsOrderStats')
export class OperationsOrderStatsModel {
  @Field(() => Int) totalToday!: number;
  @Field(() => Int) pendingCount!: number;
  @Field(() => Int) preparingCount!: number;
  @Field(() => Int) awaitingRiderCount!: number;
  @Field(() => Int) inDeliveryCount!: number;
  @Field(() => Int) deliveredToday!: number;
  @Field(() => Int) cancelledToday!: number;
  @Field(() => Int) lateActiveCount!: number;
}

@ObjectType('OperationsTimingStats')
export class OperationsTimingStatsModel {
  @Field(() => Float, { nullable: true }) avgPreparationMinutes?: number;
  @Field(() => Float, { nullable: true }) avgDeliveryMinutes?: number;
  @Field(() => Float, { nullable: true }) avgRiderWaitMinutes?: number;
  @Field(() => Float, { nullable: true }) avgCustomerWaitMinutes?: number;
}

@ObjectType('OperationsRevenueStats')
export class OperationsRevenueStatsModel {
  @Field(() => Float) today!: number;
  @Field(() => Float) thisWeek!: number;
  @Field(() => Float) thisMonth!: number;
}

@ObjectType('OperationsFleetStats')
export class OperationsFleetStatsModel {
  @Field(() => Int) totalRiders!: number;
  @Field(() => Int) onlineRiders!: number;
  @Field(() => Int) busyRiders!: number;
  @Field(() => Int) idleRiders!: number;
  @Field(() => Int) offlineRiders!: number;
}

@ObjectType('OperationsStoreStats')
export class OperationsStoreStatsModel {
  @Field(() => Int) totalStores!: number;
  @Field(() => Int) openStores!: number;
  @Field(() => Int) closedStores!: number;
  @Field(() => Int) preparingStores!: number;
}

@ObjectType('OperationsQualityStats')
export class OperationsQualityStatsModel {
  @Field(() => Float) successRatePct!: number;
  @Field(() => Float) cancellationRatePct!: number;
  @Field(() => Int) lateDeliveriesToday!: number;
}

@ObjectType('OperationsOverview')
export class OperationsOverviewModel {
  @Field() generatedAt!: string;
  @Field(() => OperationsOrderStatsModel) orders!: OperationsOrderStatsModel;
  @Field(() => OperationsTimingStatsModel) timings!: OperationsTimingStatsModel;
  @Field(() => OperationsRevenueStatsModel) revenue!: OperationsRevenueStatsModel;
  @Field(() => OperationsFleetStatsModel) fleet!: OperationsFleetStatsModel;
  @Field(() => OperationsStoreStatsModel) stores!: OperationsStoreStatsModel;
  @Field(() => OperationsQualityStatsModel) quality!: OperationsQualityStatsModel;
}

// ── Live map ───────────────────────────────────────────────────────────────

@ObjectType('LiveMapRider')
export class LiveMapRiderModel {
  @Field(() => ID) _id!: string;
  @Field({ nullable: true }) name?: string;
  @Field({ nullable: true }) phone?: string;
  @Field({ nullable: true }) vehicleType?: string;
  @Field(() => Boolean) online!: boolean;
  @Field(() => Boolean) available!: boolean;
  @Field(() => Boolean) busy!: boolean;
  @Field(() => Float, { nullable: true }) latitude?: number;
  @Field(() => Float, { nullable: true }) longitude?: number;
  @Field({ nullable: true }) lastSeenAt?: string;
  @Field(() => ID, { nullable: true }) currentOrderId?: string;
  @Field({ nullable: true }) currentOrderDisplayId?: string;
  @Field({ nullable: true }) currentOrderStatus?: string;
}

@ObjectType('LiveMapStore')
export class LiveMapStoreModel {
  @Field(() => ID) _id!: string;
  @Field({ nullable: true }) name?: string;
  @Field(() => Boolean) open!: boolean;
  @Field(() => Float, { nullable: true }) latitude?: number;
  @Field(() => Float, { nullable: true }) longitude?: number;
  @Field(() => Int) activeOrdersCount!: number;
}

@ObjectType('LiveMapData')
export class LiveMapDataModel {
  @Field() generatedAt!: string;
  @Field(() => [LiveMapRiderModel]) riders!: LiveMapRiderModel[];
  @Field(() => [LiveMapStoreModel]) stores!: LiveMapStoreModel[];
}

// ── Alert center ───────────────────────────────────────────────────────────

@ObjectType('OperationalAlert')
export class OperationalAlertModel {
  /** Stable per-condition id ("{orderId|riderId|zoneId|CITYWIDE}:{type}") so the client can dedupe/ack. */
  @Field(() => ID) id!: string;
  // STORE_NOT_ACCEPTING | PREPARING_TOO_LONG | NO_RIDER_ASSIGNED |
  // PICKUP_DELAYED | DELIVERY_LATE | RIDER_GPS_LOST | RIDER_IDLE_TOO_LONG |
  // TOO_FEW_RIDERS_ONLINE | RIDER_REJECTED_MULTIPLE | SCHEDULED_ORDER_SOON |
  // TOO_MANY_IDLE_RIDERS | CITYWIDE_DISPATCH_EMERGENCY
  @Field() type!: string;
  // EMERGENCY | CRITICAL | HIGH | MEDIUM | LOW
  @Field() severity!: string;
  /** Not order-scoped for rider/zone/city-wide alert types (RIDER_IDLE_TOO_LONG, TOO_FEW_RIDERS_ONLINE, TOO_MANY_IDLE_RIDERS, CITYWIDE_DISPATCH_EMERGENCY). */
  @Field(() => ID, { nullable: true }) orderId?: string;
  @Field({ nullable: true }) orderDisplayId?: string;
  @Field({ nullable: true }) orderStatus?: string;
  @Field({ nullable: true }) restaurantName?: string;
  @Field(() => ID, { nullable: true }) restaurantId?: string;
  @Field({ nullable: true }) riderName?: string;
  @Field(() => ID, { nullable: true }) riderId?: string;
  @Field({ nullable: true }) customerName?: string;
  @Field(() => ID, { nullable: true }) zoneId?: string;
  @Field({ nullable: true }) zoneTitle?: string;
  @Field(() => Int) minutesSince!: number;
  @Field() suggestedAction!: string;
}

// ── Live operations feed (order-timeline subscription) ───────────────────────

/**
 * One entry per statusHistory append (see orders.service.ts's
 * pushStatusHistory), published live on the `operationsFeed` subscription
 * for the admin timeline UI. Not persisted — statusHistory on Order is the
 * durable source of truth, this is only the live-push projection of it.
 */
@ObjectType('OperationsFeedItem')
export class OperationsFeedItemModel {
  @Field(() => ID) orderId!: string;
  @Field({ nullable: true }) orderDisplayId?: string;
  @Field() status!: string;
  // ADMIN | RIDER | STORE | CUSTOMER | SYSTEM
  @Field() actor!: string;
  @Field({ nullable: true }) actorId?: string;
  @Field() at!: string;
  @Field({ nullable: true }) riderName?: string;
  @Field({ nullable: true }) restaurantName?: string;
}

// ── Rider operational profile (rider detail drawer) ─────────────────────────

@ObjectType('RiderOperationalProfile')
export class RiderOperationalProfileModel {
  @Field(() => ID) riderId!: string;
  @Field({ nullable: true }) name?: string;
  @Field({ nullable: true }) phone?: string;
  @Field({ nullable: true }) vehicleType?: string;
  @Field({ nullable: true }) licensePlate?: string;
  @Field(() => Boolean) online!: boolean;
  @Field(() => Boolean) available!: boolean;
  @Field(() => Boolean) busy!: boolean;
  @Field(() => Int) acceptedAssignmentsCount!: number;
  @Field(() => Int) rejectedAssignmentsCount!: number;
  /** accepted / (accepted + rejected) × 100, undefined when the rider has no assignment history yet. */
  @Field(() => Float, { nullable: true }) acceptanceRatePct?: number;
  @Field(() => Int) deliveriesTodayCount!: number;
  /**
   * Sum of COD order amounts (in minor units, i.e. cents) collected today
   * (`codCollectedAt` set, `paymentMethod === 'COD'`, delivered today). Falls
   * back to `orderAmount * 100` for legacy orders lacking `orderAmountMinor`.
   */
  @Field(() => Float) cashCollectedTodayMinor!: number;
  /** % of today's deliveries where deliveredAt <= expectedTime; undefined when neither field is comparable for any order. */
  @Field(() => Float, { nullable: true }) onTimeRatePct?: number;
  @Field(() => Float, { nullable: true }) currentWalletAmount?: number;
  @Field({ nullable: true }) lastSeenAt?: string;
  @Field(() => ID, { nullable: true }) zoneId?: string;
  @Field({ nullable: true }) zoneTitle?: string;
}

// ── Zone operational stats ───────────────────────────────────────────────────

/** Maps to green/orange/red/black on the frontend. */
export enum ZoneOperationalStatus {
  HEALTHY = 'HEALTHY',
  BUSY = 'BUSY',
  SATURATED = 'SATURATED',
  CRITICAL = 'CRITICAL',
}
registerEnumType(ZoneOperationalStatus, { name: 'ZoneOperationalStatus' });

@ObjectType('ZoneRiderCounts')
export class ZoneRiderCountsModel {
  @Field(() => Int) online!: number;
  @Field(() => Int) busy!: number;
  @Field(() => Int) idle!: number;
}

@ObjectType('ZoneOperationalStats')
export class ZoneOperationalStatsModel {
  @Field(() => ID) zoneId!: string;
  @Field() zoneTitle!: string;
  @Field(() => ZoneRiderCountsModel) riderCount!: ZoneRiderCountsModel;
  @Field(() => Int) activeOrdersCount!: number;
  @Field(() => Int) openStoresCount!: number;
  @Field(() => Float, { nullable: true }) avgDeliveryMinutes?: number;
  @Field(() => Int) lateCount!: number;
  /** 0-100 heuristic blending order-per-online-rider load and lateness. */
  @Field(() => Int) saturationScore!: number;
  @Field(() => ZoneOperationalStatus) status!: ZoneOperationalStatus;
}

// ── Dispatch hotspots ─────────────────────────────────────────────────────────

export enum DispatchHotspotType {
  HIGH_DEMAND = 'HIGH_DEMAND',
  NO_RIDER = 'NO_RIDER',
  SATURATED_ZONE = 'SATURATED_ZONE',
  SLOW_RESTAURANT = 'SLOW_RESTAURANT',
}
registerEnumType(DispatchHotspotType, { name: 'DispatchHotspotType' });

@ObjectType('DispatchHotspot')
export class DispatchHotspotModel {
  @Field(() => Float) latitude!: number;
  @Field(() => Float) longitude!: number;
  @Field(() => Float) radiusMeters!: number;
  @Field(() => Int) orderCount!: number;
  @Field(() => DispatchHotspotType) type!: DispatchHotspotType;
  @Field(() => ID, { nullable: true }) zoneId?: string;
  @Field({ nullable: true }) zoneTitle?: string;
  @Field({ nullable: true }) label?: string;
}

// ── Crisis snapshot ───────────────────────────────────────────────────────────

@ObjectType('CrisisZoneSummary')
export class CrisisZoneSummaryModel {
  @Field(() => ID) zoneId!: string;
  @Field() zoneTitle!: string;
  @Field(() => ZoneOperationalStatus) status!: ZoneOperationalStatus;
  @Field(() => Int) activeOrdersCount!: number;
  @Field(() => Int) onlineRiderCount!: number;
}

@ObjectType('CrisisSnapshot')
export class CrisisSnapshotModel {
  @Field() generatedAt!: string;
  @Field(() => Int) pendingOrdersCount!: number;
  /** Orders in PREPARED with no rider yet assigned, city-wide. */
  @Field(() => Int) unassignedOrdersCount!: number;
  @Field(() => [CrisisZoneSummaryModel]) saturatedZones!: CrisisZoneSummaryModel[];
  @Field(() => Int) ridersShortCount!: number;
  @Field(() => Int) restaurantsOverwhelmedCount!: number;
  /** Human-readable, ranked (e.g. "Zone Centre-Ville: 12 commandes non assignées"). */
  @Field(() => [String]) topProblems!: string[];
  @Field(() => Boolean) isEmergency!: boolean;
}
