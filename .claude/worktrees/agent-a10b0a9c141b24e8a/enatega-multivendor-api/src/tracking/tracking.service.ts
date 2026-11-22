import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ThrottlerException } from '@nestjs/throttler';
import { createHash, randomBytes, randomUUID } from 'crypto';
import Redis from 'ioredis';
import { Model, Types } from 'mongoose';
import { haversineKm } from '../common/geo/haversine';
import { NotificationsService } from '../notifications/notifications.service';
import { Order, OrderDocument } from '../orders/order.schema';
import { AppPubSub, PUB_SUB, REDIS_CLIENT } from '../pubsub/pubsub.module';
import { Rider, RiderDocument } from '../riders/rider.schema';
import { Events } from '../subscriptions/events';
import { User, UserDocument } from '../users/user.schema';
import { RiderLocationInput } from './dto/rider-location.input';
import { TrailPointInput } from './dto/trail-point.input';
import { TRACKING_CONFIG, TrackingConfig } from './tracking.config';
import { RiderLocationModel, TrackingSessionModel } from './tracking.model';
import { OrderTrailModel } from './order-trail.model';
import { RiderDayTrailModel } from './rider-day-trail.model';
import {
  OrderTrail,
  OrderTrailDocument,
  ORDER_TRAIL_MAX_POINTS,
} from './order-trail.schema';

const GEOFENCE_RADIUS_KM = 0.5;

// Fleet-wide `fleetRiderLocationUpdated` subscription throttle: only publish a
// rider's presence update when they've moved at least this far since the last
// publish, or at least this long has elapsed — otherwise a fleet of riders
// pinging every few seconds would flood the (single-instance, in-memory)
// PubSub for no real benefit to a dispatcher's map.
const FLEET_LOCATION_MIN_MOVE_METERS = 15;
const FLEET_LOCATION_MIN_INTERVAL_MS = 5_000;

interface StoredSession {
  sessionId: string;
  orderId: string;
  riderId: string;
  expiresAt: string;
}

interface StoredPresenceSession {
  sessionId: string;
  riderId: string;
  expiresAt: string;
}

interface StoredLocation {
  orderId: string;
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  headingDegrees?: number;
  speedMetersPerSecond?: number;
  capturedAt: string;
  receivedAt: string;
  updateId: string;
}

export type DispatchPresenceSource = 'redis' | 'mongo' | 'redis+mongo' | 'none';

export interface DispatchPresenceResult {
  riderIds: string[];
  source: DispatchPresenceSource;
}

const TRACKABLE_STATUSES = ['ASSIGNED', 'PICKED'];

/**
 * Marker published on an order channel to tell every replica's active customer
 * subscribers that tracking has ended (order terminal, rider reassigned/removed,
 * or no longer trackable). Subscribers close their iterator on receipt instead of
 * relying on the client to unsubscribe. A plain string field survives the Redis
 * JSON round-trip, unlike a Symbol key.
 */
const TRACKING_TERMINATED = '__terminated';

const CAS_SCRIPT = `
local current = redis.call('GET', KEYS[1])
if current then
  local decoded = cjson.decode(current)
  if decoded.capturedAt == ARGV[1] and decoded.updateId == ARGV[2] then
    return {0, current}
  end
  if decoded.capturedAt > ARGV[1] or decoded.capturedAt == ARGV[1] then
    return {-1, current}
  end
end
redis.call('SET', KEYS[1], ARGV[3], 'EX', ARGV[4])
return {1, ARGV[3]}
`;

@Injectable()
export class TrackingService {
  // In-process (per-API-instance) last-published fleet position per rider,
  // used only to throttle fleetRiderLocationUpdated publishes — follows the
  // same lightweight in-process-cache pattern as DeliveryEstimationService's
  // cache (no shared/Redis state needed for a throttle, and correctness
  // doesn't depend on it: a missed throttle window just means one extra
  // publish after a restart, never a lost/incorrect location).
  private readonly lastPublishedFleetPosition = new Map<
    string,
    { latitude: number; longitude: number; at: number }
  >();

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(PUB_SUB) private readonly pubSub: AppPubSub,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Rider.name) private readonly riderModel: Model<RiderDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(OrderTrail.name) private readonly orderTrailModel: Model<OrderTrailDocument>,
    @Inject(TRACKING_CONFIG) private readonly config: TrackingConfig,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createSession(clerkId: string, orderId: string): Promise<TrackingSessionModel> {
    const orderObjectId = this.objectId(orderId, 'Order');
    const rider = await this.riderModel.findOne({ clerkId, isActive: true }, '_id').lean().exec();
    if (!rider) throw new NotFoundException('Rider not found');

    const order = await this.orderModel
      .findOne(
        { _id: orderObjectId, rider: rider._id, orderStatus: { $in: TRACKABLE_STATUSES } },
        '_id',
      )
      .lean()
      .exec();
    if (!order) throw new ForbiddenException('Order is not actively assigned to this rider');

    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + this.config.sessionTtlSeconds * 1000);
    const session: StoredSession = {
      sessionId: randomUUID(),
      orderId,
      riderId: String(rider._id),
      expiresAt: expiresAt.toISOString(),
    };

    try {
      await this.revokeOrder(orderId);
      const tx = this.redis.multi();
      tx.set(this.sessionKey(tokenHash), JSON.stringify(session), 'EX', this.config.sessionTtlSeconds);
      tx.set(this.orderSessionKey(orderId), tokenHash, 'EX', this.config.sessionTtlSeconds);
      await tx.exec();
    } catch {
      throw this.unavailable();
    }
    return { token, expiresAt };
  }

  async updateLocation(
    token: string | undefined,
    orderId: string,
    input: RiderLocationInput,
    bufferedPoints?: TrailPointInput[],
  ): Promise<RiderLocationModel> {
    if (!token) throw new UnauthorizedException('Missing tracking token');
    const tokenHash = this.hashToken(token);

    let session: StoredSession;
    try {
      const raw = await this.redis.get(this.sessionKey(tokenHash));
      if (!raw) throw new UnauthorizedException('Invalid or expired tracking token');
      session = JSON.parse(raw) as StoredSession;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw this.unavailable();
    }

    if (session.orderId !== orderId)
      throw new ForbiddenException('Tracking token is not valid for this order');
    await this.enforceRateLimit(session.sessionId);

    const capturedAt =
      input.capturedAt instanceof Date ? input.capturedAt : new Date(input.capturedAt);
    if (capturedAt.getTime() > Date.now() + this.config.futureToleranceMs) {
      throw new BadRequestException('Location timestamp is too far in the future');
    }

    const order = await this.orderModel
      .findOne(
        {
          _id: this.objectId(orderId, 'Order'),
          rider: this.objectId(session.riderId, 'Rider'),
          orderStatus: { $in: TRACKABLE_STATUSES },
        },
        '_id orderStatus deliveryAddress user nearbyNotificationSent',
      )
      .lean()
      .exec();
    if (!order) {
      await this.terminateOrderTracking(orderId);
      throw new ForbiddenException('Order is no longer trackable by this rider');
    }

    const stored: StoredLocation = {
      orderId,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracyMeters: input.accuracyMeters,
      headingDegrees: input.headingDegrees,
      speedMetersPerSecond: input.speedMetersPerSecond,
      capturedAt: capturedAt.toISOString(),
      receivedAt: new Date().toISOString(),
      updateId: input.updateId,
    };

    let accepted: StoredLocation;
    try {
      const result = (await this.redis.eval(
        CAS_SCRIPT,
        1,
        this.latestKey(orderId),
        stored.capturedAt,
        stored.updateId,
        JSON.stringify(stored),
        String(this.config.locationTtlSeconds),
      )) as [number, string];
      if (Number(result[0]) < 0)
        throw new BadRequestException(
          'Location update is stale or conflicts with the latest point',
        );
      accepted = JSON.parse(result[1]) as StoredLocation;
      // A freshly accepted point (result[0] > 0) is broadcast to the watching
      // customer. The customer may now watch from ASSIGNED (rider heading to the
      // restaurant), not only from PICKED.
      if (Number(result[0]) > 0 && TRACKABLE_STATUSES.includes(order.orderStatus ?? '')) {
        await this.pubSub.publish(this.orderChannel(orderId), {
          orderRiderLocationUpdated: this.toModel(accepted),
        });
        // Durably append to the order's route trail (best-effort — never block the
        // live update). Capture runs only for trackable statuses, so it naturally
        // stops once the order reaches a terminal state. Any buffered intermediate
        // points (offline backlog / between-publish samples) are flushed in the same
        // write, in chronological order, ending with the freshest accepted point.
        await this.appendTrailPoint(
          orderId,
          session.riderId,
          this.buildTrailPoints(bufferedPoints, accepted),
        );
        // Geofence: push "votre livreur approche" once when rider is within 500m
        if (
          order.orderStatus === 'PICKED' &&
          !(order as any).nearbyNotificationSent &&
          (order as any).deliveryAddress?.location?.coordinates?.length >= 2 &&
          (order as any).user
        ) {
          const [dlng, dlat] = (order as any).deliveryAddress.location.coordinates as number[];
          const distKm = haversineKm(accepted.latitude, accepted.longitude, dlat, dlng);
          if (distKm < GEOFENCE_RADIUS_KM) {
            this.orderModel
              .updateOne(
                { _id: (order as any)._id, nearbyNotificationSent: { $ne: true } },
                { $set: { nearbyNotificationSent: true } },
              )
              .exec()
              .then(async (res) => {
                if (res.modifiedCount > 0) {
                  const user = await this.userModel
                    .findById((order as any).user, 'clerkId')
                    .lean()
                    .exec();
                  if ((user as any)?.clerkId) {
                    await this.notificationsService.sendPushToUser(
                      (user as any).clerkId,
                      'CUSTOMER',
                      'Votre livreur approche 🛵',
                      'Votre commande arrive dans quelques minutes !',
                      { type: 'RIDER_NEARBY', orderId },
                    );
                  }
                }
              })
              .catch(() => {});
          }
        }
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw this.unavailable();
    }
    return this.toModel(accepted);
  }

  /**
   * Normalize an optional batch of buffered intermediate points plus the freshest
   * accepted point into a single chronological trail-point array. Buffered points
   * are validated/clamped the same way the live point already was and de-duplicated
   * against the freshest point's timestamp; the freshest point is always last.
   */
  private buildTrailPoints(
    bufferedPoints: TrailPointInput[] | undefined,
    accepted: StoredLocation,
  ): { latitude: number; longitude: number; capturedAt: Date }[] {
    const acceptedAt = new Date(accepted.capturedAt).getTime();
    const buffered = (bufferedPoints ?? [])
      .filter(
        (p) =>
          Number.isFinite(p.latitude) &&
          Number.isFinite(p.longitude) &&
          Math.abs(p.latitude) <= 90 &&
          Math.abs(p.longitude) <= 180 &&
          !(p.latitude === 0 && p.longitude === 0),
      )
      .map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
        capturedAt: p.capturedAt instanceof Date ? p.capturedAt : new Date(p.capturedAt),
      }))
      .filter((p) => p.capturedAt.getTime() < acceptedAt)
      .sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
    return [
      ...buffered,
      {
        latitude: accepted.latitude,
        longitude: accepted.longitude,
        capturedAt: new Date(accepted.capturedAt),
      },
    ];
  }

  /** Append one or more accepted points to the order's durable route trail in a
   * single write. Best-effort: a storage hiccup must never disrupt live tracking. */
  private async appendTrailPoint(
    orderId: string,
    riderId: string,
    points: { latitude: number; longitude: number; capturedAt: Date }[],
  ): Promise<void> {
    if (!points.length) return;
    try {
      await this.orderTrailModel
        .updateOne(
          { order: this.objectId(orderId, 'Order') },
          {
            $setOnInsert: { order: this.objectId(orderId, 'Order') },
            $set: { rider: this.objectId(riderId, 'Rider') },
            $push: {
              points: {
                $each: points,
                $slice: -ORDER_TRAIL_MAX_POINTS,
              },
            },
          },
          { upsert: true },
        )
        .exec();
    } catch {
      // Trail persistence is non-critical; live tracking continues regardless.
    }
  }

  /**
   * Read an order's route trail. Support/admin only — used to reconstruct what
   * happened on a delivery (wrong drop-off, "never arrived" disputes). Not exposed
   * to customers.
   */
  async getOrderTrail(orderId: string): Promise<OrderTrailModel | null> {
    const trail = await this.orderTrailModel
      .findOne({ order: this.objectId(orderId, 'Order') })
      .lean()
      .exec();
    if (!trail) return null;
    return {
      orderId,
      riderId: (trail as any).rider ? String((trail as any).rider) : undefined,
      points: this.mapTrailPoints((trail as any).points),
    };
  }

  /** Shared point-shape mapping reused by getOrderTrail (single order) and
   * getRiderDayTrail (many orders concatenated) — normalizes capturedAt to a
   * Date regardless of how Mongoose/lean deserialized it. */
  private mapTrailPoints(
    points: { latitude: number; longitude: number; capturedAt: Date | string }[] | undefined,
  ): { latitude: number; longitude: number; capturedAt: Date }[] {
    return (points ?? []).map((p) => ({
      latitude: p.latitude,
      longitude: p.longitude,
      capturedAt: p.capturedAt instanceof Date ? p.capturedAt : new Date(p.capturedAt),
    }));
  }

  /**
   * Reconstructs a rider's full day: every order they touched that calendar
   * day (assigned/picked/delivered within the day window), concatenated with
   * each order's existing route trail (see getOrderTrail/appendTrailPoint),
   * into one time-ordered point list plus a chronological stop list. Support/
   * admin only — same audience as orderRouteTrail.
   */
  async getRiderDayTrail(riderId: string, date: string): Promise<RiderDayTrailModel> {
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(dayStart.getTime())) {
      throw new BadRequestException('date must be a valid YYYY-MM-DD calendar date');
    }
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const dayStartIso = dayStart.toISOString();
    const dayEndIso = dayEnd.toISOString();
    const riderObjectId = this.objectId(riderId, 'Rider');

    const inWindow = (field: string) => ({ [field]: { $gte: dayStartIso, $lt: dayEndIso } });
    const orders = await this.orderModel
      .find(
        {
          rider: riderObjectId,
          $or: [inWindow('assignedAt'), inWindow('pickedAt'), inWindow('deliveredAt')],
        },
        '_id orderId orderStatus assignedAt pickedAt deliveredAt restaurant',
      )
      .populate({ path: 'restaurant', select: '_id name' })
      .sort({ assignedAt: 1 })
      .lean()
      .exec();

    if (!orders.length) return { riderId, date, points: [], stops: [] };

    const orderIds = (orders as any[]).map((o) => o._id);
    const trails = await this.orderTrailModel
      .find({ order: { $in: orderIds } })
      .lean()
      .exec();
    const trailByOrder = new Map((trails as any[]).map((t) => [String(t.order), t]));

    const points: { latitude: number; longitude: number; capturedAt: Date; orderId: string }[] = [];
    const stops = (orders as any[]).map((order) => {
      const orderId = String(order._id);
      const trail = trailByOrder.get(orderId);
      if (trail) {
        for (const point of this.mapTrailPoints(trail.points)) {
          points.push({ ...point, orderId });
        }
      }
      return {
        orderId,
        orderDisplayId: order.orderId,
        restaurantName: order.restaurant?.name,
        orderStatus: order.orderStatus,
        assignedAt: order.assignedAt,
        pickedAt: order.pickedAt,
        deliveredAt: order.deliveredAt,
      };
    });

    points.sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
    return { riderId, date, points, stops };
  }

  /**
   * Internal, unauthenticated read of an order's last-known rider location —
   * used by OrdersService for the ARRIVED GPS proximity check. Unlike
   * getCustomerLocation, this does not assert customer ownership; callers must
   * be trusted server-side code, not a resolver argument.
   */
  async getLatestLocationForOrder(orderId: string): Promise<RiderLocationModel | null> {
    try {
      const raw = await this.redis.get(this.latestKey(orderId));
      return raw ? this.toModel(JSON.parse(raw) as StoredLocation) : null;
    } catch {
      return null;
    }
  }

  async getCustomerLocation(clerkId: string, orderId: string): Promise<RiderLocationModel | null> {
    await this.assertCustomerCanTrack(clerkId, orderId);
    try {
      const raw = await this.redis.get(this.latestKey(orderId));
      return raw ? this.toModel(JSON.parse(raw) as StoredLocation) : null;
    } catch {
      throw this.unavailable();
    }
  }

  async customerIterator(
    clerkId: string,
    orderId: string,
  ): Promise<AsyncIterableIterator<unknown>> {
    await this.assertCustomerCanTrack(clerkId, orderId);
    const source = this.pubSub.asyncIterableIterator(this.orderChannel(orderId));
    return this.terminableIterator(source);
  }

  /**
   * Wraps the per-order PubSub stream so a terminal marker (published on cleanup)
   * ends the subscription server-side. This is the §6 "reconsider authorization
   * when order state changes" enforcement: the same transitions that revoke a
   * customer's access also publish the marker, so the iterator closes instead of
   * trusting the client to stop. The marker is consumed, never forwarded to the
   * resolver, so the non-nullable RiderLocationModel payload is never violated.
   */
  private terminableIterator(
    source: AsyncIterableIterator<unknown>,
  ): AsyncIterableIterator<unknown> {
    return (async function* () {
      try {
        for await (const event of source) {
          if (
            event &&
            typeof event === 'object' &&
            (event as Record<string, unknown>)[TRACKING_TERMINATED]
          ) {
            return;
          }
          yield event;
        }
      } finally {
        await source.return?.(undefined);
      }
    })();
  }

  /**
   * Pure cleanup of session + latest-location keys. Does NOT notify subscribers,
   * so it is safe to call when replacing a session for the same assignment (rider
   * app restart) without tearing down a watching customer.
   */
  async revokeOrder(orderId: string): Promise<void> {
    try {
      const tokenHash = await this.redis.get(this.orderSessionKey(orderId));
      const keys = [this.orderSessionKey(orderId), this.latestKey(orderId)];
      if (tokenHash) keys.push(this.sessionKey(tokenHash));
      await this.redis.del(...keys);
    } catch {
      // Tracking cleanup is idempotent and must not roll back an order transition.
    }
  }

  /**
   * Cleanup plus a terminal marker for active customer subscribers. Call this from
   * authorization-changing order transitions (terminal status, rider reassignment
   * or removal). The marker is best-effort: TTL and the next re-auth check are the
   * fallback if Redis publish fails.
   */
  async terminateOrderTracking(orderId: string): Promise<void> {
    try {
      await this.pubSub.publish(this.orderChannel(orderId), {
        orderRiderLocationUpdated: null,
        [TRACKING_TERMINATED]: true,
      });
    } catch {
      // Best-effort terminal signal; never blocks the order transition.
    }
    await this.revokeOrder(orderId);
  }

  async updatePresence(clerkId: string, input: RiderLocationInput): Promise<boolean> {
    const rider = await this.riderModel
      .findOne({ clerkId, isActive: true, available: true }, '_id')
      .lean()
      .exec();
    if (!rider)
      throw new ForbiddenException('Rider must be available to publish dispatch presence');
    return this.writePresence(String(rider._id), input);
  }

  async createPresenceSession(clerkId: string): Promise<TrackingSessionModel> {
    const rider = await this.riderModel
      .findOne({ clerkId, isActive: true, available: true }, '_id')
      .lean()
      .exec();
    if (!rider) throw new ForbiddenException('Rider must be available to create dispatch presence');

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.config.sessionTtlSeconds * 1000);
    const session: StoredPresenceSession = {
      sessionId: randomUUID(),
      riderId: String(rider._id),
      expiresAt: expiresAt.toISOString(),
    };
    try {
      await this.redis.set(
        this.presenceSessionKey(this.hashToken(token)),
        JSON.stringify(session),
        'EX',
        this.config.sessionTtlSeconds,
      );
    } catch {
      throw this.unavailable();
    }
    return { token, expiresAt };
  }

  async updatePresenceByToken(
    token: string | undefined,
    input: RiderLocationInput,
  ): Promise<boolean> {
    if (!token) throw new UnauthorizedException('Missing tracking token');
    let session: StoredPresenceSession;
    try {
      const raw = await this.redis.get(this.presenceSessionKey(this.hashToken(token)));
      if (!raw) throw new UnauthorizedException('Invalid or expired tracking token');
      session = JSON.parse(raw) as StoredPresenceSession;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw this.unavailable();
    }
    await this.enforceRateLimit(session.sessionId);
    const rider = await this.riderModel
      .findOne({ _id: session.riderId, isActive: true, available: true }, '_id')
      .lean()
      .exec();
    if (!rider)
      throw new ForbiddenException('Rider must be available to publish dispatch presence');
    return this.writePresence(session.riderId, input);
  }

  private async writePresence(riderId: string, input: RiderLocationInput): Promise<boolean> {
    try {
      const tx = this.redis.multi();
      tx.geoadd('tracking:riders:geo', input.longitude, input.latitude, riderId);
      tx.set(this.presenceKey(riderId), '1', 'EX', this.config.presenceTtlSeconds);
      await tx.exec();
    } catch {
      throw this.unavailable();
    }
    try {
      await this.riderModel
        .updateOne(
          { _id: riderId },
          {
            $set: {
              lastKnownLocation: {
                type: 'Point',
                coordinates: [input.longitude, input.latitude],
              },
              lastSeenAt: new Date(),
            },
          },
        )
        .exec();
    } catch {
      // Mongo is a dispatch fallback; a persistence failure must not fail live presence.
    }
    this.publishFleetLocationThrottled(riderId, input.latitude, input.longitude).catch(() => {});
    return true;
  }

  /**
   * Publishes a throttled fleetRiderLocationUpdated event: at most once per
   * FLEET_LOCATION_MIN_INTERVAL_MS per rider, or immediately if the rider has
   * moved more than FLEET_LOCATION_MIN_MOVE_METERS since the last publish.
   * Best-effort — a publish failure must never fail the presence write it
   * follows.
   */
  private async publishFleetLocationThrottled(
    riderId: string,
    latitude: number,
    longitude: number,
  ): Promise<void> {
    const now = Date.now();
    const last = this.lastPublishedFleetPosition.get(riderId);
    if (last) {
      const elapsedMs = now - last.at;
      const movedMeters = haversineKm(last.latitude, last.longitude, latitude, longitude) * 1000;
      if (elapsedMs < FLEET_LOCATION_MIN_INTERVAL_MS && movedMeters < FLEET_LOCATION_MIN_MOVE_METERS) {
        return;
      }
    }
    this.lastPublishedFleetPosition.set(riderId, { latitude, longitude, at: now });
    try {
      await this.pubSub.publish(Events.RIDER_LOCATION_UPDATED, {
        [Events.RIDER_LOCATION_UPDATED]: {
          riderId,
          latitude,
          longitude,
          capturedAt: new Date(now),
        },
      });
    } catch {
      // Best-effort; the fleet map falls back to polling operationsOverview/liveMapData.
    }
  }

  /** Admin-only fleet-wide rider presence stream — see Events.RIDER_LOCATION_UPDATED. */
  fleetLocationIterator(): AsyncIterableIterator<unknown> {
    return this.pubSub.asyncIterableIterator(Events.RIDER_LOCATION_UPDATED);
  }

  async findNearbyRiderIds(
    longitude: number,
    latitude: number,
    radiusKm: number,
  ): Promise<string[]> {
    try {
      const result = (await this.redis.call(
        'GEOSEARCH',
        'tracking:riders:geo',
        'FROMLONLAT',
        String(longitude),
        String(latitude),
        'BYRADIUS',
        String(radiusKm),
        'km',
        'ASC',
        'COUNT',
        '100',
      )) as string[];
      if (!result.length) return [];
      const presence = await this.redis.mget(result.map((id) => this.presenceKey(id)));
      const stale = result.filter((_id, index) => !presence[index]);
      if (stale.length) await this.redis.zrem('tracking:riders:geo', ...stale);
      return result.filter((_id, index) => Boolean(presence[index]));
    } catch {
      return [];
    }
  }

  isRedisReady(): boolean {
    return this.redis.status === 'ready';
  }

  /**
   * Fleet-wide presence snapshot (rider ids currently online) for the admin
   * operations views. Redis is authoritative — the same geo zset + presence
   * keys dispatch reads — and when Redis is unavailable we degrade to the
   * Mongo `lastSeenAt` window exactly like dispatch fallback does, so ops and
   * dispatch never disagree about who is online.
   */
  async listOnlineRiderIds(): Promise<string[]> {
    try {
      if (this.isRedisReady()) {
        const members = (await this.redis.zrange('tracking:riders:geo', 0, -1)) as string[];
        if (!members.length) return [];
        const presence = await this.redis.mget(members.map((id) => this.presenceKey(id)));
        const stale = members.filter((_id, index) => !presence[index]);
        if (stale.length) await this.redis.zrem('tracking:riders:geo', ...stale);
        return members.filter((_id, index) => Boolean(presence[index]));
      }
    } catch {
      // fall through to the Mongo fallback below
    }
    const cutoff = new Date(Date.now() - this.config.dispatchFallbackStaleSeconds * 1000);
    const riders = await this.riderModel
      .find({ available: true, isActive: true, lastSeenAt: { $gte: cutoff } }, '_id')
      .lean()
      .exec();
    return riders.map((rider) => String(rider._id));
  }

  async findDispatchablePresence({
    longitude,
    latitude,
    radiusKm,
  }: {
    longitude: number;
    latitude: number;
    radiusKm: number;
  }): Promise<DispatchPresenceResult> {
    const redisRiderIds = await this.findNearbyRiderIds(longitude, latitude, radiusKm);
    let mongoRiderIds: string[] = [];
    if (!redisRiderIds.length || !this.isRedisReady()) {
      mongoRiderIds = await this.findNearbyRiderIdsFromMongo(longitude, latitude, radiusKm);
    }

    const riderIds = [...new Set([...redisRiderIds, ...mongoRiderIds])];
    if (!riderIds.length) return { riderIds, source: 'none' };
    if (redisRiderIds.length && mongoRiderIds.length) return { riderIds, source: 'redis+mongo' };
    if (mongoRiderIds.length) return { riderIds, source: 'mongo' };
    return { riderIds, source: 'redis' };
  }

  async findNearbyRiderIdsFromMongo(
    longitude: number,
    latitude: number,
    radiusKm: number,
  ): Promise<string[]> {
    const cutoff = new Date(Date.now() - this.config.dispatchFallbackStaleSeconds * 1000);
    const riders = await this.riderModel
      .find(
        {
          available: true,
          isActive: true,
          notificationToken: { $exists: true, $ne: null },
          isOrderNotification: { $ne: false },
          lastSeenAt: { $gte: cutoff },
          lastKnownLocation: {
            $geoWithin: {
              $centerSphere: [[longitude, latitude], radiusKm / 6378.1],
            },
          },
        },
        '_id',
      )
      .lean()
      .exec();
    return riders.map((rider) => String(rider._id));
  }

  private async assertCustomerCanTrack(clerkId: string, orderId: string): Promise<void> {
    const user = await this.userModel.findOne({ clerkId, isActive: true }, '_id').lean().exec();
    if (!user) throw new ForbiddenException('Customer not found');
    const order = await this.orderModel
      .findOne(
        {
          _id: this.objectId(orderId, 'Order'),
          user: user._id,
          rider: { $ne: null },
          // Customer may track from assignment onward (watch the rider approach the
          // restaurant), not only after pickup.
          orderStatus: { $in: TRACKABLE_STATUSES },
        },
        '_id',
      )
      .lean()
      .exec();
    if (!order) throw new ForbiddenException('Live tracking is unavailable for this order');
  }

  private async enforceRateLimit(sessionId: string): Promise<void> {
    try {
      const key = `tracking:rate:${sessionId}`;
      const count = await this.redis.incr(key);
      if (count === 1) await this.redis.expire(key, this.config.rateLimitWindowSeconds);
      if (count > this.config.rateLimitMax)
        throw new ThrottlerException('Tracking update rate exceeded');
    } catch (error) {
      if (error instanceof ThrottlerException) throw error;
      throw this.unavailable();
    }
  }

  private toModel(location: StoredLocation): RiderLocationModel {
    return {
      ...location,
      capturedAt: new Date(location.capturedAt),
      receivedAt: new Date(location.receivedAt),
    };
  }

  private objectId(value: string, label: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) throw new BadRequestException(`${label} id is invalid`);
    return new Types.ObjectId(value);
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private sessionKey(hash: string): string {
    return `tracking:session:${hash}`;
  }
  private presenceSessionKey(hash: string): string {
    return `tracking:presence-session:${hash}`;
  }
  private orderSessionKey(orderId: string): string {
    return `tracking:order:${orderId}:session`;
  }
  private latestKey(orderId: string): string {
    return `tracking:order:${orderId}:latest`;
  }
  private orderChannel(orderId: string): string {
    return `tracking:order:${orderId}:events`;
  }
  private presenceKey(riderId: string): string {
    return `tracking:rider:${riderId}:presence`;
  }
  private unavailable(): ServiceUnavailableException {
    return new ServiceUnavailableException('TRACKING_UNAVAILABLE');
  }
}
