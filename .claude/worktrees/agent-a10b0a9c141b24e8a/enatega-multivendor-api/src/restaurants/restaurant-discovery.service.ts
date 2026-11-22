import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Restaurant, RestaurantDocument } from './restaurant.schema';
import { ORDER_STATS_PORT, OrderStatsPort } from '../orders/order-stats.port';
import {
  RESTAURANT_REVIEWS_PORT,
  RestaurantReviewsPort,
} from '../orders/restaurant-reviews.port';
import { Zone, ZoneDocument } from '../zones/zone.schema';
import { RestaurantPreviewModel } from './restaurant.model';

@Injectable()
export class RestaurantDiscoveryService {
  private readonly logger = new Logger(RestaurantDiscoveryService.name);

  constructor(
    @InjectModel(Restaurant.name)
    private readonly restaurantModel: Model<RestaurantDocument>,
    @Inject(ORDER_STATS_PORT)
    private readonly orderStats: OrderStatsPort,
    @Inject(RESTAURANT_REVIEWS_PORT)
    private readonly reviewsPort: RestaurantReviewsPort,
    @InjectModel(Zone.name)
    private readonly zoneModel: Model<ZoneDocument>,
  ) {}

// Builds the shopType filter. A request value may target the legacy structural
  // vertical ('restaurant' | 'grocery') stored on `shopType`, or a custom
  // admin-defined ShopType referenced by slug on `shopCategory`. Match either.
  private shopTypeFilter(shopType?: string): Record<string, unknown> {
    if (!shopType) return {};
    return { $or: [{ shopType }, { shopCategory: shopType }] };
  }

/**
   * Resolve the admin-defined working zone(s) (the `zones` collection) that cover the
   * customer's point and build a restaurant-location restriction from them.
   *
   * - `inService: false` → the point is outside every active zone: there is no service
   *   area, so callers should return an empty list.
   * - `clause` present → an `$or` over `$geoWithin` for each covering zone; merge it into
   *   the query under `$and` so it does not clobber the shopType `$or`.
   * - neither → no usable coordinates, so no geographic restriction is applied.
   *
   * Coordinates are GeoJSON order: [longitude, latitude].
   */
  private async zoneRestriction(
    latitude: number,
    longitude: number,
  ): Promise<{ inService: boolean; clause?: Record<string, unknown> }> {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return { inService: true };
    }

    const point = { type: 'Point' as const, coordinates: [longitude, latitude] };
    const zones = await this.zoneModel
      .find({ isActive: true, location: { $geoIntersects: { $geometry: point } } }, 'location')
      .lean()
      .exec();

    if (!zones.length) {
      return { inService: false };
    }

    return {
      inService: true,
      clause: {
        $or: zones.map((z) => ({ location: { $geoWithin: { $geometry: z.location } } })),
      },
    };
  }

  async nearByRestaurants(latitude: number, longitude: number, shopType?: string) {
    const query: Record<string, unknown> = { isActive: true, ...this.shopTypeFilter(shopType) };

    const zone = await this.zoneRestriction(latitude, longitude);
    if (!zone.inService) {
      return { offers: [], sections: [], restaurants: [] };
    }
    if (zone.clause) {
      query.$and = [zone.clause];
    }

    const restaurants = await this.restaurantModel
      .find(query)
      .populate('owner', '_id email isActive')
      .lean()
      .exec();

    return { offers: [], sections: [], restaurants };
  }

// ── web preview queries ────────────────────────────────────────────────────

  private toPreview(r: any): RestaurantPreviewModel {
    return {
      _id: String(r._id),
      orderId: r.orderId,
      orderPrefix: r.orderPrefix,
      name: r.name,
      image: r.image,
      logo: r.logo,
      address: r.address,
      username: r.username,
      password: r.password,
      slug: r.slug,
      sections: r.sections,
      rating: r.rating,
      stripeDetailsSubmitted: r.stripeDetailsSubmitted,
      commissionRate: r.commissionRate,
      tax: r.tax,
      notificationToken: r.notificationToken,
      enableNotification: r.enableNotification,
      shopType: r.shopType,
      shopCategory: r.shopCategory,
      keywords: r.keywords,
      tags: r.tags,
      minimumOrder: r.minimumOrder,
      deliveryTime: r.deliveryTime,
      location:
        r.location && Array.isArray(r.location.coordinates) && r.location.coordinates.length >= 2
          ? r.location
          : undefined,
      reviewCount: r.reviewCount,
      reviewAverage: r.rating,
      cuisines: r.cuisines,
      openingTimes: r.openingTimes,
      timezone: r.timezone,
      isAvailable: r.isAvailable,
      isActive: r.isActive,
      deliveryInfo: r.deliveryInfo,
    };
  }

  async recentOrderRestaurants(
    latitude: number,
    longitude: number,
  ): Promise<any[]> {
    const zone = await this.zoneRestriction(latitude, longitude);
    if (!zone.inService) return [];

    const query: Record<string, unknown> = { isActive: true };
    if (zone.clause) query.$and = [zone.clause];

    return this.restaurantModel
      .find(query)
      .sort({ rating: -1 })
      .limit(10)
      .lean()
      .exec();
  }

  async mostOrderedRestaurants(
    latitude: number,
    longitude: number,
    shopType?: string,
    page = 1,
    limit = 20,
  ): Promise<any[]> {
    const zone = await this.zoneRestriction(latitude, longitude);
    if (!zone.inService) return [];

    const query: Record<string, unknown> = { isActive: true, ...this.shopTypeFilter(shopType) };
    if (zone.clause) query.$and = [zone.clause];
    const skip = (page - 1) * limit;
    return this.restaurantModel
      .find(query)
      .sort({ rating: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();
  }

  async recentOrderRestaurantsPreview(
    latitude: number,
    longitude: number,
  ): Promise<RestaurantPreviewModel[]> {
    const zone = await this.zoneRestriction(latitude, longitude);
    if (!zone.inService) return [];

    const query: Record<string, unknown> = { isActive: true };
    if (zone.clause) query.$and = [zone.clause];

    const restaurants = await this.restaurantModel.find(query).lean().exec();
    if (!restaurants.length) return [];

    // Order restaurants by how recently they last received an order, so the
    // preview reflects real ordering activity rather than static rating.
    const ids = restaurants.map((r) => String(r._id));
    const recent = await this.orderStats.lastOrderTimestamps(ids);
    const lastOrderAt = new Map(
      recent.map((r) => [r.restaurantId, r.lastOrderAt]),
    );

    return restaurants
      .sort(
        (a, b) =>
          (lastOrderAt.get(String(b._id)) ?? 0) -
            (lastOrderAt.get(String(a._id)) ?? 0) ||
          (b.rating ?? 0) - (a.rating ?? 0),
      )
      .slice(0, 10)
      .map((r) => this.toPreview(r));
  }

  async mostOrderedRestaurantsPreview(
    latitude: number,
    longitude: number,
    shopType?: string,
    page = 1,
    limit = 20,
  ): Promise<RestaurantPreviewModel[]> {
    const zone = await this.zoneRestriction(latitude, longitude);
    if (!zone.inService) return [];

    const query: Record<string, unknown> = { isActive: true, ...this.shopTypeFilter(shopType) };
    if (zone.clause) query.$and = [zone.clause];

    const restaurants = await this.restaurantModel.find(query).lean().exec();
    if (!restaurants.length) return [];

    // Rank by the actual number of orders each restaurant has received (the
    // point of "most ordered"), falling back to rating to break ties.
    const ids = restaurants.map((r) => String(r._id));
    const counts = await this.orderStats.orderCounts(ids);
    const orderCount = new Map(counts.map((c) => [c.restaurantId, c.count]));

    const skip = (page - 1) * limit;
    return restaurants
      .sort(
        (a, b) =>
          (orderCount.get(String(b._id)) ?? 0) -
            (orderCount.get(String(a._id)) ?? 0) ||
          (b.rating ?? 0) - (a.rating ?? 0),
      )
      .slice(skip, skip + limit)
      .map((r) => this.toPreview(r));
  }

// Rating-sorted preview, kept distinct from "most ordered" so the
  // topRatedVendorsPreview resolver no longer borrows order-count ranking.
  async topRatedRestaurantsPreview(
    latitude: number,
    longitude: number,
    shopType?: string,
    page = 1,
    limit = 20,
  ): Promise<RestaurantPreviewModel[]> {
    const zone = await this.zoneRestriction(latitude, longitude);
    if (!zone.inService) return [];

    const query: Record<string, unknown> = { isActive: true, ...this.shopTypeFilter(shopType) };
    if (zone.clause) query.$and = [zone.clause];
    const skip = (page - 1) * limit;
    const restaurants = await this.restaurantModel
      .find(query)
      .sort({ rating: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();
    return restaurants.map((r) => this.toPreview(r));
  }

  async nearByRestaurantsPreviewResult(
    latitude: number,
    longitude: number,
    shopType?: string,
    page?: number,
    limit?: number,
  ) {
    const result = await this.nearByRestaurants(latitude, longitude, shopType);
    let restaurants = result.restaurants as any[];

    // Paginate only when a positive limit is supplied; otherwise return all.
    if (limit && limit > 0) {
      const currentPage = page && page > 0 ? page : 1;
      const skip = (currentPage - 1) * limit;
      restaurants = restaurants.slice(skip, skip + limit);
    }

    return {
      restaurants: restaurants.map((r) => this.toPreview(r)),
    };
  }

// ── reviews ────────────────────────────────────────────────────────────────

  async reviewsByRestaurant(restaurantId: string) {
    return this.reviewsPort.reviewsByRestaurant(restaurantId);
  }
}
