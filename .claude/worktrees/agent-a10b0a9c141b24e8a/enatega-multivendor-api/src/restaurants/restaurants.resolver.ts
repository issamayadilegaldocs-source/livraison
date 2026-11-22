import { Args, Float, Int, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { ConfigService } from '@nestjs/config';
import {
  AddonModel,
  CategoryDetailMobileModel,
  CategoryDetailModel,
  CategoryModel,
  FoodModel,
  NearByRestaurantsResultModel,
  NearByRestaurantsPreviewResultModel,
  OptionModel,
  OwnerWithRestaurantsModel,
  PopularItemModel,
  RestaurantModel,
  RestaurantPreviewModel,
  ReviewsByRestaurantResultModel,
} from './restaurant.model';
import { GeoPointModel } from '../common/models/geo.model';
import { ZoneModel } from '../zones/zone.model';
import { RestaurantsService } from './restaurants.service';
import { CatalogService } from './catalog.service';
import { evaluateOpen } from '../common/opening-hours.util';

const DEFAULT_TIMEZONE_FALLBACK = 'UTC';

/**
 * Server-computed open/closed status shared by `Restaurant` and
 * `RestaurantPreview`. Both types carry `openingTimes`/`isAvailable`/`timezone`,
 * so a single evaluator keeps the badge and the order gate on one code path.
 */
function resolveIsOpen(
  restaurant: { openingTimes?: any[]; isAvailable?: boolean; timezone?: string | null },
  defaultTimezone: string,
): boolean {
  return evaluateOpen({
    openingTimes: restaurant.openingTimes,
    isAvailable: restaurant.isAvailable,
    timezone: restaurant.timezone ?? defaultTimezone,
  }).isOpen;
}

function resolveNextOpenAt(
  restaurant: { openingTimes?: any[]; isAvailable?: boolean; timezone?: string | null },
  defaultTimezone: string,
): string | null {
  const status = evaluateOpen({
    openingTimes: restaurant.openingTimes,
    isAvailable: restaurant.isAvailable,
    timezone: restaurant.timezone ?? defaultTimezone,
  });
  return status.nextOpenAt ? status.nextOpenAt.toISOString() : null;
}

@Resolver(() => RestaurantModel)
export class RestaurantsResolver {
  constructor(
    private readonly restaurantsService: RestaurantsService,
    private readonly catalogService: CatalogService,
    private readonly config: ConfigService,
  ) {}

  private get defaultTimezone(): string {
    return this.config.get<string>('DEFAULT_RESTAURANT_TIMEZONE') ?? DEFAULT_TIMEZONE_FALLBACK;
  }

  @Query(() => [RestaurantModel], { name: 'restaurants' })
  restaurants() {
    return this.restaurantsService.findAll();
  }

  @Query(() => RestaurantModel, { name: 'restaurant', nullable: true })
  restaurant(
    @Args('id', { type: () => String, nullable: true }) id?: string,
    @Args('slug', { type: () => String, nullable: true }) slug?: string,
  ) {
    // Nullable public query: a stale/deleted id (clients persist cart restaurant
    // ids on-device) resolves to null so callers can clear the stale cart,
    // instead of blowing up the whole screen with a GraphQL error.
    if (id) return this.restaurantsService.findByIdOrNull(id);
    if (slug) return this.restaurantsService.findBySlug(slug);
    return null;
  }

  // Slim header-only fetch (no `categories`/menu) for instant header paint on the
  // mobile restaurant screen — see RestaurantsService.findHeaderById.
  @Query(() => RestaurantModel, { name: 'restaurantHeader', nullable: true })
  restaurantHeader(@Args('id', { type: () => String }) id: string) {
    return this.restaurantsService.findHeaderById(id);
  }

  @Query(() => NearByRestaurantsResultModel, { name: 'nearByRestaurants' })
  nearByRestaurants(
    @Args('latitude', { type: () => Float, nullable: true }) latitude?: number,
    @Args('longitude', { type: () => Float, nullable: true }) longitude?: number,
    @Args('shopType', { type: () => String, nullable: true }) shopType?: string,
  ) {
    return this.restaurantsService.nearByRestaurants(latitude ?? 0, longitude ?? 0, shopType);
  }

  @Query(() => NearByRestaurantsPreviewResultModel, { name: 'nearByRestaurantsPreview' })
  nearByRestaurantsPreview(
    @Args('latitude', { type: () => Float, nullable: true }) latitude?: number,
    @Args('longitude', { type: () => Float, nullable: true }) longitude?: number,
    @Args('page', { type: () => Int, nullable: true }) page?: number,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('shopType', { type: () => String, nullable: true }) shopType?: string,
  ) {
    return this.restaurantsService.nearByRestaurantsPreviewResult(
      latitude ?? 0,
      longitude ?? 0,
      shopType,
      page,
      limit,
    );
  }

  @Query(() => [RestaurantModel], { name: 'recentOrderRestaurants' })
  recentOrderRestaurants(
    @Args('latitude', { type: () => Float }) latitude: number,
    @Args('longitude', { type: () => Float }) longitude: number,
  ) {
    return this.restaurantsService.recentOrderRestaurants(latitude, longitude);
  }

  @Query(() => [RestaurantModel], { name: 'mostOrderedRestaurants' })
  mostOrderedRestaurants(
    @Args('latitude', { type: () => Float, nullable: true }) latitude?: number,
    @Args('longitude', { type: () => Float, nullable: true }) longitude?: number,
    @Args('shopType', { type: () => String, nullable: true }) shopType?: string,
  ) {
    return this.restaurantsService.mostOrderedRestaurants(latitude ?? 0, longitude ?? 0, shopType);
  }

  @Query(() => [RestaurantPreviewModel], { name: 'recentOrderRestaurantsPreview' })
  recentOrderRestaurantsPreview(
    @Args('latitude', { type: () => Float }) latitude: number,
    @Args('longitude', { type: () => Float }) longitude: number,
  ) {
    return this.restaurantsService.recentOrderRestaurantsPreview(latitude, longitude);
  }

  @Query(() => [RestaurantPreviewModel], { name: 'mostOrderedRestaurantsPreview' })
  mostOrderedRestaurantsPreview(
    @Args('latitude', { type: () => Float, nullable: true }) latitude?: number,
    @Args('longitude', { type: () => Float, nullable: true }) longitude?: number,
    @Args('page', { type: () => Int, nullable: true }) page?: number,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('shopType', { type: () => String, nullable: true }) shopType?: string,
  ) {
    return this.restaurantsService.mostOrderedRestaurantsPreview(latitude ?? 0, longitude ?? 0, shopType, page, limit);
  }

  @Query(() => [RestaurantPreviewModel], { name: 'topRatedVendorsPreview' })
  topRatedVendorsPreview(
    @Args('latitude', { type: () => Float }) latitude: number,
    @Args('longitude', { type: () => Float }) longitude: number,
    @Args('shopType', { type: () => String, nullable: true }) shopType?: string,
  ) {
    return this.restaurantsService.topRatedRestaurantsPreview(latitude, longitude, shopType);
  }

  @Query(() => [RestaurantModel], { name: 'topRatedVendors' })
  topRatedVendors(
    @Args('latitude', { type: () => Float }) latitude: number,
    @Args('longitude', { type: () => Float }) longitude: number,
  ) {
    return this.restaurantsService.mostOrderedRestaurants(latitude, longitude);
  }

  @Query(() => ReviewsByRestaurantResultModel, { name: 'reviewsByRestaurant' })
  reviewsByRestaurant(
    @Args('restaurant', { type: () => String }) restaurant: string,
  ) {
    return this.restaurantsService.reviewsByRestaurant(restaurant);
  }

  @Query(() => [CategoryDetailModel], { name: 'fetchCategoryDetailsByStoreId' })
  fetchCategoryDetailsByStoreId(
    @Args('storeId', { type: () => String }) storeId: string,
  ) {
    return this.catalogService.fetchCategoryDetailsByStoreId(storeId);
  }

  @Query(() => [FoodModel], { name: 'popularFoodItems' })
  popularFoodItems(
    @Args('restaurantId', { type: () => String }) restaurantId: string,
  ) {
    return this.catalogService.popularFoodItems(restaurantId);
  }

  @Query(() => [PopularItemModel], { name: 'popularItems' })
  popularItems(
    @Args('restaurantId', { type: () => String }) restaurantId: string,
  ) {
    return this.catalogService.popularItems(restaurantId);
  }

  @Query(() => [String], { name: 'relatedItems' })
  relatedItems(
    @Args('itemId', { type: () => String }) itemId: string,
    @Args('restaurantId', { type: () => String }) restaurantId: string,
  ) {
    return this.catalogService.relatedItems(itemId, restaurantId);
  }

  @Query(() => [CategoryDetailMobileModel], { name: 'fetchCategoryDetailsByStoreIdForMobile' })
  fetchCategoryDetailsByStoreIdForMobile(
    @Args('storeId', { type: () => String }) storeId: string,
  ) {
    return this.catalogService.fetchCategoryDetailsByStoreIdForMobile(storeId);
  }

  @ResolveField('reviewData', () => ReviewsByRestaurantResultModel, { nullable: true })
  async reviewData(@Parent() restaurant: RestaurantModel) {
    return this.restaurantsService.reviewsByRestaurant(restaurant._id);
  }

  // Catalog is stored in its own collections (slice 4b); the menu is resolved
  // lazily so list queries that do not select it pay nothing. `categories`
  // attaches each category's foods inline, so `Category.foods` reads straight
  // off the parent without an extra round-trip.
  @ResolveField('categories', () => [CategoryModel], { nullable: true })
  categories(@Parent() restaurant: RestaurantModel) {
    return this.catalogService.categoriesWithFoodsForRestaurant(restaurant._id);
  }

  @ResolveField('options', () => [OptionModel], { nullable: true })
  options(@Parent() restaurant: RestaurantModel) {
    return this.catalogService.optionsForRestaurant(restaurant._id);
  }

  @ResolveField('addons', () => [AddonModel], { nullable: true })
  addons(@Parent() restaurant: RestaurantModel) {
    return this.catalogService.addonsForRestaurant(restaurant._id);
  }

  @ResolveField('isOpen', () => Boolean, { nullable: true })
  isOpen(@Parent() restaurant: RestaurantModel): boolean {
    return resolveIsOpen(restaurant, this.defaultTimezone);
  }

  @ResolveField('nextOpenAt', () => String, { nullable: true })
  nextOpenAt(@Parent() restaurant: RestaurantModel): string | null {
    return resolveNextOpenAt(restaurant, this.defaultTimezone);
  }

  // Normalize legacy/empty geo objects (e.g. `{}` persisted before the schema
  // fix) to `null` so the non-nullable `GeoPoint.coordinates` field never
  // receives a location without valid coordinates.
  @ResolveField('location', () => GeoPointModel, { nullable: true })
  location(@Parent() restaurant: RestaurantModel): GeoPointModel | null {
    const loc = restaurant.location;
    if (loc && Array.isArray(loc.coordinates) && loc.coordinates.length >= 2) {
      return loc;
    }
    return null;
  }

  // `zone` is operationally derived from the restaurant's GPS point. The old
  // stored `restaurant.zone` ref is intentionally ignored so dispatch cannot
  // drift from the restaurant location.
  @ResolveField('zone', () => ZoneModel, { nullable: true })
  async zone(@Parent() restaurant: RestaurantModel): Promise<ZoneModel | null> {
    return this.restaurantsService.findZoneByRestaurantLocation(restaurant) as Promise<ZoneModel | null>;
  }
}

/**
 * Resolves the server-computed open/closed status on the lightweight listing
 * type. Most listing queries return `RestaurantPreview`, so without this the
 * schema would reject `isOpen`/`nextOpenAt` selections on those queries.
 */
@Resolver(() => RestaurantPreviewModel)
export class RestaurantPreviewResolver {
  constructor(private readonly config: ConfigService) {}

  private get defaultTimezone(): string {
    return this.config.get<string>('DEFAULT_RESTAURANT_TIMEZONE') ?? DEFAULT_TIMEZONE_FALLBACK;
  }

  @ResolveField('isOpen', () => Boolean, { nullable: true })
  isOpen(@Parent() restaurant: RestaurantPreviewModel): boolean {
    return resolveIsOpen(restaurant, this.defaultTimezone);
  }

  @ResolveField('nextOpenAt', () => String, { nullable: true })
  nextOpenAt(@Parent() restaurant: RestaurantPreviewModel): string | null {
    return resolveNextOpenAt(restaurant, this.defaultTimezone);
  }
}
