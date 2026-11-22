import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { createClerkClient } from '@clerk/backend';
import { ConfigService } from '@nestjs/config';
import { Restaurant, RestaurantDocument } from './restaurant.schema';
import { ORDER_STATS_PORT, OrderStatsPort } from '../orders/order-stats.port';
import { Owner, OwnerDocument } from '../owners/owner.schema';
import { RestaurantInput, RestaurantProfileInput, BussinessDetailsInput } from './dto/restaurant.input';
import { CoordinatesInput, PolygonInput, CircleBoundsInput } from '../common/dto/geo.input';
import { normalizeTimeValue } from '../common/scalars/time-value.scalar';
import { GoogleTimezoneProvider } from '../providers/google-timezone.provider';

@Injectable()
export class RestaurantProfileService {
  private readonly logger = new Logger(RestaurantProfileService.name);

  constructor(
    @InjectModel(Restaurant.name)
    private readonly restaurantModel: Model<RestaurantDocument>,
    @Inject(ORDER_STATS_PORT)
    private readonly orderStats: OrderStatsPort,
    @InjectModel(Owner.name)
    private readonly ownerModel: Model<OwnerDocument>,
    private readonly config: ConfigService,
    private readonly timezoneProvider: GoogleTimezoneProvider,
  ) {}

// ── mutations ─────────────────────────────────────────────────────────────

  async create(input: RestaurantInput, ownerId: string): Promise<RestaurantDocument> {
    const coords = input.location?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2 || !coords.every(Number.isFinite)) {
      throw new BadRequestException('Restaurant location (coordinates) is required');
    }

    // The credential (email in `username` + password) lives only in Clerk, the
    // identity source of truth — the password is never persisted to Mongo.
    const { password, username: rawUsername, ...rest } = input;
    const username = rawUsername?.toLowerCase().trim();

    // Provision a Clerk STORE identity so this restaurant can sign into the
    // store app on its own. A random secret is used when none is supplied.
    let clerkId: string | undefined;
    if (username) {
      const plain = password ?? Math.random().toString(36).slice(-10);
      clerkId = await this.provisionClerkStore({ email: username, password: plain, name: input.name });
    }

    // Derive the IANA timezone from the location so the open/closed evaluator
    // judges hours in the restaurant's zone, not the server clock. Never blocks
    // creation: a null result (no key / API error) just leaves timezone unset.
    const timezone = await this.deriveTimezone(coords);

    const doc = new this.restaurantModel({
      ...rest,
      ...(username ? { username } : {}),
      owner: new Types.ObjectId(ownerId),
      location: { type: 'Point', coordinates: coords },
      ...(timezone ? { timezone } : {}),
      ...(clerkId ? { clerkId } : {}),
    });
    const saved = await doc.save();
    return saved.populate('owner', '_id email isActive');
  }

/**
   * Resolves an IANA timezone from `[lng, lat]` coordinates. Tolerant of bad
   * input and provider failure — returns null so callers leave `timezone` unset
   * and the evaluator falls back to the configured default. Never throws.
   */
  private async deriveTimezone(coordinates?: number[]): Promise<string | null> {
    if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
    const [lng, lat] = coordinates;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    try {
      return await this.timezoneProvider.timezoneFor([lng, lat]);
    } catch {
      return null;
    }
  }

  async delete(id: string): Promise<RestaurantDocument> {
    // The admin "active" switch maps to this mutation, so it must toggle the
    // store's status both ways — forcing `isActive: false` here made
    // deactivation one-way and left no path to reactivate a store.
    const existing = await this.restaurantModel
      .findById(id, 'isActive')
      .lean()
      .exec();
    if (!existing) throw new NotFoundException(`Restaurant ${id} not found`);

    const updated = await this.restaurantModel
      .findByIdAndUpdate(id, { $set: { isActive: !existing.isActive } }, { new: true })
      .lean()
      .exec();
    if (!updated) throw new NotFoundException(`Restaurant ${id} not found`);
    return updated as RestaurantDocument;
  }

  async hardDelete(id: string): Promise<boolean> {
    // Referential integrity: a restaurant with order history must not be
    // permanently deleted — that would orphan financial/historical records.
    // The soft delete (`delete`, isActive:false) above is the safe path.
    const orderCount = await this.orderStats.countOrdersForRestaurant(id);
    if (orderCount > 0) {
      throw new ConflictException(
        `Cannot permanently delete this restaurant because it has ${orderCount} order${orderCount === 1 ? '' : 's'} in its history. Deactivate it instead to hide it from customers.`,
      );
    }

    const result = await this.restaurantModel.findByIdAndDelete(id).exec();
    if (result?.owner) {
      // Drop the now-dangling reference from the owning vendor.
      await this.ownerModel
        .updateOne({ _id: result.owner }, { $pull: { restaurants: result._id } })
        .exec();
    }
    return result !== null;
  }

  async edit(input: RestaurantProfileInput): Promise<RestaurantDocument> {
    // Password is intentionally pulled out of the Mongo write — syncClerkStore
    // pushes it to Clerk, where the credential is stored.
    const { _id, location, password, username, ...rest } = input;
    const existing = await this.restaurantModel.findById(_id).exec();
    if (!existing) throw new NotFoundException(`Restaurant ${_id} not found`);

    const patch: Record<string, unknown> = Object.fromEntries(
      Object.entries(rest).filter(([, v]) => v !== undefined),
    );
    const unset: Record<string, ''> = {};
    if (username !== undefined) patch.username = username.toLowerCase().trim();
    if (location?.coordinates?.length) {
      patch.location = { type: 'Point', coordinates: location.coordinates };
      unset.zone = '';
      // Re-derive timezone only when coordinates change.
      const timezone = await this.deriveTimezone(location.coordinates);
      if (timezone) patch.timezone = timezone;
    }

    // Mirror email/password changes into Clerk so the store login keeps working
    // after an admin edit. Returns a clerkId when this edit had to provision a
    // Clerk identity for a restaurant that predated per-store login.
    const linkedClerkId = await this.syncClerkStore(existing, { username, password, name: input.name });
    if (linkedClerkId) patch.clerkId = linkedClerkId;

    const updated = await this.restaurantModel
      .findByIdAndUpdate(
        _id,
        { $set: patch, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
        { new: true },
      )
      .populate('owner', '_id email isActive')
      .lean()
      .exec();

    if (!updated) throw new NotFoundException(`Restaurant ${_id} not found`);
    return updated as RestaurantDocument;
  }

// ── Clerk store provisioning ────────────────────────────────────────────────

  private clerk() {
    const secretKey = this.config.getOrThrow<string>('CLERK_SECRET_KEY');
    return createClerkClient({ secretKey });
  }

/** Resolves a first/last name pair from a restaurant's display name. */
  private splitName(name?: string): { firstName?: string; lastName?: string } {
    const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return {};
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') || undefined };
  }

/**
   * Creates a Clerk user (role=STORE) for the restaurant's email/password and
   * returns its id.
   *
   * If the email already has a Clerk account it may be reused as this store's
   * identity, but only when that is safe:
   *   - the account must not already be an ADMIN or VENDOR (those identities
   *     belong to owners/admins and must not be repurposed as a store), and
   *   - the account must not already be linked to a *different* restaurant
   *     (clerkId is unique — one Clerk identity binds at most one store).
   * Either violation throws a ConflictException so the admin sees a clear error
   * instead of silently aliasing two stores onto one login.
   *
   * Generic Clerk failures (e.g. an outage) degrade to a Mongo-only record
   * (returns undefined) so admin CRUD doesn't break — only deliberate conflicts
   * throw.
   */
  private async provisionClerkStore(args: {
    email: string;
    password: string;
    name?: string;
    excludeRestaurantId?: Types.ObjectId | string;
  }): Promise<string | undefined> {
    if (!args.email) return undefined;
    const clerk = this.clerk();
    const { firstName, lastName } = this.splitName(args.name);
    try {
      const user = await clerk.users.createUser({
        emailAddress: [args.email],
        password: args.password,
        firstName,
        lastName,
        publicMetadata: { role: 'STORE' },
        skipPasswordChecks: true,
      });
      return user.id;
    } catch (err: any) {
      // Email already registered in Clerk — consider reusing that account.
      if (err?.status === 422 || err?.clerkError) {
        const [existing] = (await clerk.users.getUserList({ emailAddress: [args.email] })).data;
        if (existing) {
          const role = (existing.publicMetadata as Record<string, unknown>)?.role;
          // Never repurpose an owner/admin/rider identity as a store login.
          if (role === 'ADMIN' || role === 'VENDOR' || role === 'RIDER') {
            throw new ConflictException(
              `The email ${args.email} already belongs to a${role === 'ADMIN' ? 'n' : ''} ${role.toLowerCase()} account and cannot be used as a store login.`,
            );
          }
          // Never bind a Clerk identity already attached to another restaurant.
          const linkedTo = await this.restaurantModel
            .findOne({
              clerkId: existing.id,
              ...(args.excludeRestaurantId
                ? { _id: { $ne: new Types.ObjectId(String(args.excludeRestaurantId)) } }
                : {}),
            })
            .select('_id')
            .lean()
            .exec();
          if (linkedTo) {
            throw new ConflictException(
              `The email ${args.email} is already linked to another store.`,
            );
          }
          if (!role) {
            await clerk.users.updateUserMetadata(existing.id, { publicMetadata: { role: 'STORE' } });
          }
          return existing.id;
        }
      }
      this.logger.warn(`[provisionClerkStore] Clerk createUser failed: ${err?.message ?? err}`);
      return undefined;
    }
  }

/**
   * Pushes an admin's email/password edit into Clerk. If the restaurant has no
   * Clerk identity yet and a password was supplied, provisions one and returns
   * its id so the caller can persist the link. Otherwise returns undefined.
   *
   * Clerk is the source of truth for the credential, so a failed sync on a
   * linked restaurant THROWS rather than swallowing the error: this keeps the
   * caller from persisting a new Mongo username that Clerk never accepted (a
   * permanent desync that future edits — seeing no email change — would never
   * retry). A ConflictException from provisioning also propagates.
   */
  private async syncClerkStore(
    restaurant: RestaurantDocument,
    input: { username?: string; password?: string; name?: string },
  ): Promise<string | undefined> {
    const newEmail = input.username?.toLowerCase().trim();
    const emailChanged = !!newEmail && newEmail !== restaurant.username;
    if (!input.password && !emailChanged) return undefined;

    const clerkId = restaurant.clerkId;

    // Restaurant predates per-store Clerk login. We can only create a Clerk
    // account when a password is provided (Clerk needs one); an email-only edit
    // is skipped.
    if (!clerkId) {
      if (!input.password) return undefined;
      return this.provisionClerkStore({
        email: newEmail ?? restaurant.username ?? '',
        password: input.password,
        name: input.name ?? restaurant.name,
        excludeRestaurantId: restaurant._id as Types.ObjectId,
      });
    }

    const clerk = this.clerk();
    try {
      if (input.password) {
        await clerk.users.updateUser(clerkId, {
          password: input.password,
          skipPasswordChecks: true,
        });
      }
      if (emailChanged && newEmail) {
        // Clerk emails are immutable objects: add the new address as a verified
        // primary, then drop the old ones so the sign-in identifier matches.
        const created = await clerk.emailAddresses.createEmailAddress({
          userId: clerkId,
          emailAddress: newEmail,
          primary: true,
          verified: true,
        });
        const user = await clerk.users.getUser(clerkId);
        await Promise.all(
          user.emailAddresses
            .filter((e) => e.id !== created.id)
            .map((e) =>
              clerk.emailAddresses.deleteEmailAddress(e.id).catch(() => undefined),
            ),
        );
      }
    } catch (err: any) {
      // Fail the edit so the caller does not persist a credential change that
      // Clerk rejected. The admin can retry once Clerk is reachable.
      this.logger.warn(`[syncClerkStore] Clerk update failed: ${err?.message ?? err}`);
      throw new ServiceUnavailableException(
        'Could not sync the store credentials with the identity provider. No changes were saved — please try again.',
      );
    }
    return undefined;
  }

  async updateDeliveryBoundsAndLocation(
    id: string,
    boundType: string,
    location: CoordinatesInput,
    bounds?: PolygonInput,
    circleBounds?: CircleBoundsInput,
    address?: string,
    postCode?: string,
    city?: string,
  ) {
    const normalizedBoundType = boundType.toLowerCase();
    const patch: Record<string, unknown> = {
      boundType,
      location: { type: 'Point', coordinates: location.coordinates },
    };
    const unset: Record<string, ''> = { zone: '' };

    // This path also writes `location`, so a moved restaurant must re-derive its
    // timezone and clear the legacy stored zone.
    const timezone = await this.deriveTimezone(location.coordinates);
    if (timezone) patch.timezone = timezone;

    if (normalizedBoundType === 'point') {
      unset.deliveryBounds = '';
      unset.circleBounds = '';
    } else {
      const polygon = this.normalizeGeoPolygon(bounds);
      if (bounds && !polygon) {
        throw new BadRequestException(
          'Delivery bounds polygon must contain at least 3 different vertices and a closed ring',
        );
      }
      if (polygon) {
        patch.deliveryBounds = polygon;
      } else {
        unset.deliveryBounds = '';
      }

      if (normalizedBoundType === 'radius' && circleBounds) {
        patch.circleBounds = circleBounds;
      } else {
        unset.circleBounds = '';
      }
    }
    if (address !== undefined) patch.address = address;
    if (postCode !== undefined) patch.postCode = postCode;
    if (city !== undefined) patch.city = city;

    const update: Record<string, unknown> = { $set: patch };
    if (Object.keys(unset).length) update.$unset = unset;

    const updated = await this.restaurantModel
      .findByIdAndUpdate(id, update, { new: true })
      .lean()
      .exec();

    if (!updated) throw new NotFoundException(`Restaurant ${id} not found`);
    return { success: true, message: 'Updated', data: updated };
  }

  private normalizeGeoPolygon(bounds?: PolygonInput): { type: 'Polygon'; coordinates: number[][][] } | null {
    const rings = bounds?.coordinates;
    if (!Array.isArray(rings) || !rings.length) return null;

    const normalizedRings: number[][][] = [];
    for (const ring of rings) {
      if (!Array.isArray(ring) || ring.length < 3) return null;

      const normalizedRing: number[][] = [];
      for (const position of ring) {
        if (
          !Array.isArray(position) ||
          position.length < 2 ||
          !Number.isFinite(position[0]) ||
          !Number.isFinite(position[1])
        ) {
          return null;
        }
        normalizedRing.push([position[0], position[1]]);
      }

      const first = normalizedRing[0];
      const last = normalizedRing[normalizedRing.length - 1];
      if (!this.sameCoordinates(first, last)) normalizedRing.push([...first]);

      const uniqueVertices = new Set(
        normalizedRing.slice(0, -1).map(([lng, lat]) => `${lng}:${lat}`),
      );
      if (normalizedRing.length < 4 || uniqueVertices.size < 3) return null;

      normalizedRings.push(normalizedRing);
    }

    return { type: 'Polygon', coordinates: normalizedRings };
  }

  private sameCoordinates(a?: number[], b?: number[]): boolean {
    return !!a && !!b && a[0] === b[0] && a[1] === b[1];
  }

  async updateDelivery(
    id: string,
    minDeliveryFee?: number,
    deliveryDistance?: number,
    deliveryFee?: number,
  ) {
    const patch: Record<string, unknown> = {};
    if (minDeliveryFee !== undefined) patch['deliveryInfo.minDeliveryFee'] = minDeliveryFee;
    if (deliveryDistance !== undefined) patch['deliveryInfo.deliveryDistance'] = deliveryDistance;
    if (deliveryFee !== undefined) patch['deliveryInfo.deliveryFee'] = deliveryFee;

    const updated = await this.restaurantModel
      .findByIdAndUpdate(id, { $set: patch }, { new: true })
      .lean()
      .exec();

    if (!updated) throw new NotFoundException(`Restaurant ${id} not found`);
    return { success: true, message: 'Updated', data: updated };
  }

  async updateBussinessDetails(id: string, bussinessDetails: BussinessDetailsInput) {
    const updated = await this.restaurantModel
      .findByIdAndUpdate(id, { $set: { bussinessDetails } }, { new: true })
      .lean()
      .exec();

    if (!updated) throw new NotFoundException(`Restaurant ${id} not found`);
    return { success: true, message: 'Updated', data: updated };
  }

  async duplicate(id: string, ownerId: string): Promise<RestaurantDocument> {
    const source = await this.restaurantModel.findById(id).lean().exec();
    if (!source) throw new NotFoundException(`Restaurant ${id} not found`);

    const {
      _id: _sourceId,
      slug: _slug,
      username: _username,
      unique_restaurant_id: _uid,
      zone: _zone,
      ...rest
    } = source as Record<string, unknown>;

    const copy = new this.restaurantModel({
      ...rest,
      owner: new Types.ObjectId(ownerId),
      slug: undefined,
      username: undefined,
      unique_restaurant_id: undefined,
      isActive: false,
    });

    const saved = await copy.save();
    return saved.populate('owner', '_id email isActive');
  }

  async updateCommission(id: string, commissionRate: number): Promise<RestaurantDocument> {
    const updated = await this.restaurantModel
      .findByIdAndUpdate(id, { $set: { commissionRate } }, { new: true })
      .populate('owner', '_id email isActive')
      .lean()
      .exec();
    if (!updated) throw new NotFoundException(`Restaurant ${id} not found`);
    return updated as RestaurantDocument;
  }

  async updateTimings(
    id: string,
    openingTimes: Array<{ day?: string; times?: Array<{ startTime?: string | string[]; endTime?: string | string[] }> }>,
  ): Promise<RestaurantDocument> {
    const normalizedOpeningTimes = openingTimes.map((openingTime) => ({
      ...openingTime,
      times: openingTime.times?.map((slot) => ({
        ...slot,
        startTime: normalizeTimeValue(slot.startTime),
        endTime: normalizeTimeValue(slot.endTime),
      })),
    }));

    const updated = await this.restaurantModel
      .findByIdAndUpdate(id, { $set: { openingTimes: normalizedOpeningTimes } }, { new: true })
      .populate('owner', '_id email isActive')
      .lean()
      .exec();
    if (!updated) throw new NotFoundException(`Restaurant ${id} not found`);
    return updated as RestaurantDocument;
  }

  async updateDeliveryOptions(restId: string, pickup: boolean, delivery: boolean): Promise<RestaurantDocument> {
    const updated = await this.restaurantModel
      .findByIdAndUpdate(restId, { $set: { deliveryOptions: { pickup, delivery } } }, { new: true })
      .populate('owner', '_id email isActive')
      .lean()
      .exec();
    if (!updated) throw new NotFoundException(`Restaurant ${restId} not found`);
    return updated as RestaurantDocument;
  }
}
