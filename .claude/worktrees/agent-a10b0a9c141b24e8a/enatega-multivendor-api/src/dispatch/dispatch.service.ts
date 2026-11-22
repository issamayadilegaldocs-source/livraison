import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { haversineKm } from '../common/geo/haversine';
import { GoogleRoutesProvider } from '../providers/google-routes.provider';
import { Order, OrderDocument } from '../orders/order.schema';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { RidersService } from '../riders/riders.service';
import { TrackingService, DispatchPresenceSource } from '../tracking/tracking.service';
import { NotificationsService } from '../notifications/notifications.service';
import { scoreRiderCandidate } from './dispatch-scoring';
import { ReassignmentImpactModel, RiderSuggestionModel } from './dispatch.model';

export type DispatchReason = 'accepted' | 'prepared' | 'prepared_express' | 'escalation';

export interface NotifyNearbyRidersInput {
  orderId: string;
  restaurantId: string;
  zoneId?: string;
  radiusKm: number;
  reason: DispatchReason;
}

export interface DispatchSummary {
  orderId: string;
  attemptedRiderIds: string[];
  notifiedCount: number;
  source: DispatchPresenceSource;
  skippedReason?: 'missing_origin' | 'no_presence' | 'no_targets';
}

// suggestRidersForOrder: search radius around the restaurant for dispatch
// candidates, mirroring orders.service.ts's NEARBY_RIDER_RADIUS_KM baseline.
const SUGGESTION_RADIUS_KM = 8;
// Of the ranked candidates, only the closest few get a Google Routes
// traffic-aware ETA refinement — bounding the round-trip cost/latency.
const ROUTES_REFINE_TOP_N = 5;

@Injectable()
export class DispatchService {
  private readonly logger = new Logger(DispatchService.name);

  constructor(
    private readonly restaurantsService: RestaurantsService,
    private readonly ridersService: RidersService,
    private readonly trackingService: TrackingService,
    private readonly notificationsService: NotificationsService,
    // Read-only lookup of a single order's restaurant/rider/zone/delivery
    // location for dispatch scoring — mirrors the precedent already set by
    // TrackingModule (which reads Order directly for equivalent cross-cutting
    // reads). OrdersModule already depends on DispatchModule, so depending on
    // OrdersService here would be circular; this narrow, read-only model
    // access is the pragmatic alternative documented in this repo's CLAUDE.md.
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly googleRoutesProvider: GoogleRoutesProvider,
  ) {}

  async notifyNearbyRiders(input: NotifyNearbyRidersInput): Promise<DispatchSummary> {
    const origin = await this.restaurantsService.getDispatchOrigin(input.restaurantId);
    if (!origin) {
      this.logger.warn(`[dispatch] Restaurant ${input.restaurantId} has no location, skipping`);
      return {
        orderId: input.orderId,
        attemptedRiderIds: [],
        notifiedCount: 0,
        source: 'none',
        skippedReason: 'missing_origin',
      };
    }

    const presence = await this.trackingService.findDispatchablePresence({
      longitude: origin.longitude,
      latitude: origin.latitude,
      radiusKm: input.radiusKm,
    });
    if (!presence.riderIds.length) {
      this.logger.log(`[dispatch] No fresh rider presence for order ${input.orderId}`);
      return {
        orderId: input.orderId,
        attemptedRiderIds: [],
        notifiedCount: 0,
        source: presence.source,
        skippedReason: 'no_presence',
      };
    }

    this.logger.log(
      `[dispatch] source=${presence.source} reason=${input.reason} order=${input.orderId} riders=${presence.riderIds.length}`,
    );

    const targets = await this.ridersService.findDispatchNotificationTargets({
      riderIds: presence.riderIds,
      zoneId: input.zoneId,
    });
    if (!targets.length) {
      this.logger.log(`[dispatch] No nearby notification targets for order ${input.orderId}`);
      return {
        orderId: input.orderId,
        attemptedRiderIds: presence.riderIds,
        notifiedCount: 0,
        source: presence.source,
        skippedReason: 'no_targets',
      };
    }

    const notifiedCount = await this.notificationsService.sendNearbyOrderPushes(targets, {
      orderId: input.orderId,
      restaurantName: origin.name,
    });
    return {
      orderId: input.orderId,
      attemptedRiderIds: targets.map((target) => target.riderId),
      notifiedCount,
      source: presence.source,
    };
  }

  // ── smart dispatch scoring ──────────────────────────────────────────────

  /**
   * Ranks nearby dispatchable riders for a given order using
   * scoreRiderCandidate (distance/load/acceptance/rejections/zone), then
   * refines the ETA of the closest few candidates with Google Routes
   * traffic-aware duration. Fails soft to straight-line-distance-only
   * (`etaMinutes: undefined`) when the routes call fails or is unconfigured —
   * exactly like DeliveryEstimationService already does.
   */
  async suggestRidersForOrder(orderId: string, limit = 10): Promise<RiderSuggestionModel[]> {
    const order = await this.orderModel.findById(orderId, 'restaurant zone').lean().exec();
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);
    const restaurantId = (order as any).restaurant ? String((order as any).restaurant) : undefined;
    if (!restaurantId) return [];

    const origin = await this.restaurantsService.getDispatchOrigin(restaurantId);
    if (!origin) return [];

    const presence = await this.trackingService.findDispatchablePresence({
      longitude: origin.longitude,
      latitude: origin.latitude,
      radiusKm: SUGGESTION_RADIUS_KM,
    });
    if (!presence.riderIds.length) return [];

    const riders = await this.ridersService.findByIds(presence.riderIds);
    const orderZoneId = (order as any).zone ? String((order as any).zone) : undefined;

    const candidates = riders.map((rider: any) => {
      const coords = rider.lastKnownLocation?.coordinates;
      // Unknown last-known location: fall back to the search radius itself as a
      // conservative distance estimate — the rider matched the presence search
      // but we can't pinpoint them, so treat them as "at the edge" rather than "at 0km".
      const distanceKm = coords
        ? haversineKm(origin.latitude, origin.longitude, coords[1], coords[0])
        : SUGGESTION_RADIUS_KM;
      const accepted = rider.acceptedAssignmentsCount ?? 0;
      const rejected = rider.rejectedAssignmentsCount ?? 0;
      const total = accepted + rejected;
      const acceptanceRatePct = total > 0 ? (accepted / total) * 100 : undefined;
      const riderZoneId = rider.zone ? String((rider.zone as any)._id ?? rider.zone) : undefined;
      return {
        rider,
        distanceKm,
        scored: scoreRiderCandidate({
          riderId: String(rider._id),
          distanceKm,
          hasActiveOrder: Boolean(rider.assigned),
          acceptanceRatePct,
          recentRejectedCount: rejected,
          sameZone: Boolean(orderZoneId && riderZoneId && orderZoneId === riderZoneId),
        }),
      };
    });

    candidates.sort((a, b) => b.scored.score - a.scored.score);
    const top = candidates.slice(0, Math.max(0, limit));

    const etaByRider = new Map<string, number | undefined>();
    const refineTargets = top
      .filter((c) => c.rider.lastKnownLocation?.coordinates)
      .slice(0, ROUTES_REFINE_TOP_N);
    await Promise.all(
      refineTargets.map(async (candidate) => {
        const coords = candidate.rider.lastKnownLocation!.coordinates;
        const minutes = await this.googleRoutesProvider
          .travelMinutes([coords[0], coords[1]], [origin.longitude, origin.latitude])
          .catch(() => null);
        if (minutes !== null) etaByRider.set(String(candidate.rider._id), minutes);
      }),
    );

    return top.map(({ rider, scored, distanceKm }) => ({
      riderId: String(rider._id),
      name: rider.name,
      phone: rider.phone,
      vehicleType: rider.vehicleType,
      score: scored.score,
      distanceKm: this.round(distanceKm),
      etaMinutes: etaByRider.get(String(rider._id)),
      reasons: scored.reasons,
    }));
  }

  /**
   * Compares the order's current rider (if any) against a candidate rider:
   * straight-line distance saved, plus (when Google Routes succeeds) a
   * traffic-aware before/after ETA. Fails soft (undefined ETA/distance
   * fields) when coordinates or the routing provider are unavailable — this
   * only informs a reassignment decision, it never blocks one. The frontend
   * executes the actual reassignment via the existing `assignRider` mutation.
   */
  async estimateReassignmentImpact(
    orderId: string,
    candidateRiderId: string,
  ): Promise<ReassignmentImpactModel> {
    const order = await this.orderModel.findById(orderId, 'restaurant rider').lean().exec();
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);
    const restaurantId = (order as any).restaurant ? String((order as any).restaurant) : undefined;
    const currentRiderId = (order as any).rider ? String((order as any).rider) : undefined;

    const empty: ReassignmentImpactModel = {
      orderId,
      currentRiderId,
      candidateRiderId,
      etaBeforeMinutes: undefined,
      etaAfterMinutes: undefined,
      distanceSavedKm: undefined,
    };
    if (!restaurantId) return empty;

    const origin = await this.restaurantsService.getDispatchOrigin(restaurantId);
    if (!origin) return empty;

    const [currentRider, candidateRider] = await Promise.all([
      currentRiderId ? this.ridersService.findById(currentRiderId) : Promise.resolve(null),
      this.ridersService.findById(candidateRiderId),
    ]);

    const beforeCoords = (currentRider as any)?.lastKnownLocation?.coordinates;
    const afterCoords = (candidateRider as any)?.lastKnownLocation?.coordinates;

    const distanceBeforeKm = beforeCoords
      ? haversineKm(origin.latitude, origin.longitude, beforeCoords[1], beforeCoords[0])
      : undefined;
    const distanceAfterKm = afterCoords
      ? haversineKm(origin.latitude, origin.longitude, afterCoords[1], afterCoords[0])
      : undefined;

    const [etaBeforeMinutes, etaAfterMinutes] = await Promise.all([
      beforeCoords
        ? this.googleRoutesProvider
            .travelMinutes([beforeCoords[0], beforeCoords[1]], [origin.longitude, origin.latitude])
            .catch(() => null)
        : Promise.resolve(null),
      afterCoords
        ? this.googleRoutesProvider
            .travelMinutes([afterCoords[0], afterCoords[1]], [origin.longitude, origin.latitude])
            .catch(() => null)
        : Promise.resolve(null),
    ]);

    return {
      orderId,
      currentRiderId,
      candidateRiderId,
      etaBeforeMinutes: etaBeforeMinutes ?? undefined,
      etaAfterMinutes: etaAfterMinutes ?? undefined,
      distanceSavedKm:
        distanceBeforeKm !== undefined && distanceAfterKm !== undefined
          ? this.round(distanceBeforeKm - distanceAfterKm)
          : undefined,
    };
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
