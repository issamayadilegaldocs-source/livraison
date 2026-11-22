import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';
import { createClerkClient } from '@clerk/backend';
import { ConfigService } from '@nestjs/config';
import { Restaurant, RestaurantDocument } from './restaurant.schema';
import { MoneyCurrency } from '../common/money/money';
import { buildWalletWithdrawalUpdate } from '../common/money/wallet-withdrawal-update';
import { Zone, ZoneDocument } from '../zones/zone.schema';
import { Owner, OwnerDocument } from '../owners/owner.schema';
import { RestaurantInput, RestaurantProfileInput, BussinessDetailsInput } from './dto/restaurant.input';
import { CoordinatesInput, PolygonInput, CircleBoundsInput } from '../common/dto/geo.input';
import { RestaurantPreviewModel } from './restaurant.model';
import { normalizeTimeValue } from '../common/scalars/time-value.scalar';
import { GoogleTimezoneProvider } from '../providers/google-timezone.provider';

export interface OrderOpenStatusInputs {
  isActive?: boolean;
  isAvailable?: boolean;
  openingTimes?: unknown[];
  timezone?: string;
}

@Injectable()
export class RestaurantLookupService {
  private readonly logger = new Logger(RestaurantLookupService.name);

  constructor(
    @InjectModel(Restaurant.name)
    private readonly restaurantModel: Model<RestaurantDocument>,
    @InjectModel(Owner.name)
    private readonly ownerModel: Model<OwnerDocument>,
  ) {}

  findById(id: string): Promise<RestaurantDocument | null> {
    return this.restaurantModel.findById(id).exec();
  }

  /**
   * Resolves the restaurant a Clerk identity manages. Tries the per-restaurant
   * login first (`restaurant.clerkId`); falls back to the owner-level identity
   * (`owner.clerkId` -> the owner's first linked restaurant) for vendor
   * accounts that were never given their own store login.
   *
   * `Owner.restaurants[]` is only ever pruned (on restaurant delete), never
   * appended on create — restaurant creation sets `Restaurant.owner` instead.
   * Checking `owner.restaurants[0]` alone therefore misses every restaurant
   * created the normal way, so this also matches on `restaurant.owner`
   * directly (same dual-check `OwnersService.attachVendorRestaurants` uses).
   */
  async resolveMongoIdByClerkId(clerkId: string): Promise<string> {
    const restaurant = await this.restaurantModel.findOne({ clerkId }, '_id').lean().exec();
    if (restaurant) return String((restaurant as any)._id);

    const owner = await this.ownerModel.findOne({ clerkId }, '_id restaurants').lean().exec();
    if (owner) {
      // Prefer an active restaurant so a vendor who manages more than one
      // shop (e.g. one retired, one live) resolves to the live one instead
      // of whichever document Mongo happens to return first.
      const byOwnerField =
        (await this.restaurantModel
          .findOne({ owner: owner._id, isActive: { $ne: false } }, '_id')
          .lean()
          .exec()) ??
        (await this.restaurantModel.findOne({ owner: owner._id }, '_id').lean().exec());
      const ownerRestaurantId = byOwnerField ? String(byOwnerField._id) : owner.restaurants?.[0];
      if (ownerRestaurantId) return String(ownerRestaurantId);
    }

    throw new NotFoundException('Restaurant not found for this account');
  }

  async findOrderPlacementProfile(restaurantId: string): Promise<Record<string, unknown> | null> {
    return this.restaurantModel
      .findById(
        restaurantId,
        [
          'isActive',
          'isAvailable',
          'openingTimes',
          'timezone',
          'minimumOrder',
          'tax',
          'orderPrefix',
          'deliveryBounds',
          'zone',
          'deliveryTime',
          // Needed by OrdersService.resolveOrderZoneId to geo-lookup the
          // order's zone; without it every order is created with zone
          // undefined, which hides it from riderOrders' fallback match.
          'location',
        ].join(' '),
      )
      .lean()
      .exec() as Promise<Record<string, unknown> | null>;
  }

  async incrementOrderCounter(restaurantId: string): Promise<number> {
    const updated = await this.restaurantModel
      .findByIdAndUpdate(restaurantId, { $inc: { orderId: 1 } }, { new: true })
      .lean()
      .exec();
    return (updated as any)?.orderId ?? 1;
  }

  async findOrderOpenStatusInputs(
    restaurantId: string | Types.ObjectId,
  ): Promise<OrderOpenStatusInputs | null> {
    return this.restaurantModel
      .findById(restaurantId, 'openingTimes isAvailable isActive timezone')
      .lean()
      .exec() as Promise<OrderOpenStatusInputs | null>;
  }

  async getDispatchOrigin(
    restaurantId: string,
  ): Promise<{ restaurantId: string; name: string; longitude: number; latitude: number } | null> {
    const restaurant = await this.restaurantModel
      .findById(restaurantId, 'name location')
      .lean()
      .exec();
    const coordinates = (restaurant as any)?.location?.coordinates;
    if (!restaurant || !coordinates || coordinates.length < 2) return null;
    const [longitude, latitude] = coordinates;
    return {
      restaurantId,
      name: (restaurant as any).name ?? 'Restaurant',
      longitude,
      latitude,
    };
  }

  countRestaurantsUsingCuisine(cuisineName: string): Promise<number> {
    return this.restaurantModel.countDocuments({ cuisines: cuisineName }).exec();
  }

  countRestaurantsUsingShopCategory(slug: string): Promise<number> {
    return this.restaurantModel.countDocuments({ shopCategory: slug }).exec();
  }

  findByUsername(username: string): Promise<RestaurantDocument | null> {
    return this.restaurantModel.findOne({ username: username.trim(), isActive: true }).exec();
  }

/**
   * Resolves the active restaurant owning a per-store Clerk identity, throwing
   * when none is linked. Deactivated restaurants (isActive:false) are excluded
   * so a disabled store identity cannot authenticate or read its profile.
   */
  async findByClerkIdOrThrow(clerkId: string): Promise<RestaurantDocument> {
    const restaurant = await this.restaurantModel
      .findOne({ clerkId, isActive: { $ne: false } })
      .lean()
      .exec();
    if (!restaurant) throw new NotFoundException('Store profile not found');
    return restaurant as RestaurantDocument;
  }

  findBySlug(slug: string): Promise<RestaurantDocument | null> {
    return this.restaurantModel.findOne({ slug: slug.trim(), isActive: true }).populate('owner', '_id email isActive').exec();
  }

// ── discovery queries ─────────────────────────────────────────────────────

  findAll() {
    return this.restaurantModel
      .find({ isActive: true })
      .populate('owner', '_id email isActive')
      .lean()
      .exec();
  }

  findAllAdmin() {
    return this.restaurantModel
      .find()
      .populate('owner', '_id email isActive')
      .lean()
      .exec();
  }

  async findPaginated(page = 1, limit = 10, search?: string) {
    const query: Record<string, unknown> = {};
    if (search) query.name = { $regex: search, $options: 'i' };

    const skip = (page - 1) * limit;
    const [data, totalCount] = await Promise.all([
      this.restaurantModel
        .find(query)
        .skip(skip)
        .limit(limit)
        .populate('owner', '_id email isActive')
        .lean()
        .exec(),
      this.restaurantModel.countDocuments(query).exec(),
    ]);

    return {
      data,
      totalCount,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
    };
  }

  async findByIdOrThrow(id: string): Promise<RestaurantDocument> {
    const doc = await this.restaurantModel
      .findById(id)
      .populate('owner', '_id email isActive')
      .lean()
      .exec();
    if (!doc) throw new NotFoundException(`Restaurant ${id} not found`);
    return doc as RestaurantDocument;
  }

  /**
   * Push identities for a restaurant: the per-restaurant store login
   * (`restaurant.clerkId` → STORE tokens) and the owning vendor account
   * (`owner.clerkId` → VENDOR tokens). Push tokens are registered per
   * (clerkId, role), so both identities must be addressed for an order event
   * to reach whichever account the store staff actually signed in with.
   */
  async getPushIdentities(
    restaurantId: string,
  ): Promise<{ userId: string; userType: string }[]> {
    if (!Types.ObjectId.isValid(restaurantId)) return [];
    const restaurant = await this.restaurantModel
      .findById(restaurantId, 'clerkId owner')
      .lean()
      .exec();
    if (!restaurant) return [];
    const identities: { userId: string; userType: string }[] = [];
    const storeClerkId = (restaurant as any).clerkId;
    if (storeClerkId) identities.push({ userId: storeClerkId, userType: 'STORE' });
    if ((restaurant as any).owner) {
      const owner = await this.ownerModel
        .findById((restaurant as any).owner, 'clerkId')
        .lean()
        .exec();
      const ownerClerkId = (owner as any)?.clerkId;
      if (ownerClerkId && ownerClerkId !== storeClerkId) {
        identities.push({ userId: ownerClerkId, userType: 'VENDOR' });
      }
    }
    return identities;
  }

  // Null-returning variant for public/nullable queries: clients keep restaurant
  // ids in device storage, so a deleted (or garbage) id must resolve to null —
  // not a GraphQL error — for them to detect a stale cart and recover.
  async findByIdOrNull(id: string): Promise<RestaurantDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.restaurantModel
      .findById(id)
      .populate('owner', '_id email isActive')
      .lean()
      .exec() as Promise<RestaurantDocument | null>;
  }

// Slim header fetch for instant header paint on the mobile restaurant screen.
  // The menu is no longer embedded (it lives in the catalog collections and is
  // resolved lazily), so this query is naturally light; clients that want the
  // menu select `categories` and trigger the catalog field resolver.
  async findHeaderById(id: string): Promise<RestaurantDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.restaurantModel
      .findById(id)
      .lean()
      .exec() as Promise<RestaurantDocument | null>;
  }

  async findByOwner(ownerId: string) {
    const owner = await this.restaurantModel.db
      .collection('owners')
      .findOne({ _id: new Types.ObjectId(ownerId) });

    if (!owner) throw new NotFoundException(`Owner ${ownerId} not found`);

    const restaurants = await this.restaurantModel
      .find({ owner: new Types.ObjectId(ownerId) })
      .lean()
      .exec();

    return {
      _id: owner._id,
      email: owner.email,
      userType: owner.userType,
      restaurants,
    };
  }

  async findByClerkId(clerkId: string): Promise<RestaurantDocument | null> {
    return this.restaurantModel.findOne({ clerkId }).lean().exec() as Promise<RestaurantDocument | null>;
  }
}
