import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { RestaurantDocument } from './restaurant.schema';
import { RestaurantPreviewModel } from './restaurant.model';
import { MoneyCurrency } from '../common/money/money';
import { ZoneDocument } from '../zones/zone.schema';
import { RestaurantInput, RestaurantProfileInput, BussinessDetailsInput } from './dto/restaurant.input';
import { CoordinatesInput, PolygonInput, CircleBoundsInput } from '../common/dto/geo.input';
import { OrderOpenStatusInputs, RestaurantLookupService } from './restaurant-lookup.service';
import { RestaurantWalletService } from './restaurant-wallet.service';
import { RestaurantZonesService } from './restaurant-zones.service';
import { RestaurantDiscoveryService } from './restaurant-discovery.service';
import { RestaurantProfileService } from './restaurant-profile.service';
import { RestaurantAvailabilityService } from './restaurant-availability.service';

@Injectable()
export class RestaurantsService {
  constructor(
    private readonly lookup: RestaurantLookupService,
    private readonly wallet: RestaurantWalletService,
    private readonly zones: RestaurantZonesService,
    private readonly discovery: RestaurantDiscoveryService,
    private readonly profile: RestaurantProfileService,
    private readonly availability: RestaurantAvailabilityService,
  ) {}

  findById(id: string): Promise<RestaurantDocument | null> {
    return this.lookup.findById(id);
  }

  async resolveMongoIdByClerkId(clerkId: string): Promise<string> {
    return this.lookup.resolveMongoIdByClerkId(clerkId);
  }

  /** Clerk identities (store login + owner) whose push tokens should receive store-facing order events. */
  async getPushIdentities(
    restaurantId: string,
  ): Promise<{ userId: string; userType: string }[]> {
    return this.lookup.getPushIdentities(restaurantId);
  }

  async getCommissionRate(storeId: string): Promise<number> {
    return this.wallet.getCommissionRate(storeId);
  }

  async getWalletContext(
    clerkId: string,
  ): Promise<{ id: string; currentWalletAmount: number; currentWalletAmountMinor?: number } | null> {
    return this.wallet.getWalletContext(clerkId);
  }

  async debitWalletForWithdrawal(
    restaurantId: string,
    amount: number,
    amountMinor?: number,
    currencyConfig?: MoneyCurrency,
  ): Promise<void> {
    return this.wallet.debitWalletForWithdrawal(restaurantId, amount, amountMinor, currencyConfig);
  }

  async creditWalletForWithdrawal(
    restaurantId: string,
    amount: number,
    amountMinor?: number,
    currencyConfig?: MoneyCurrency,
  ): Promise<void> {
    return this.wallet.creditWalletForWithdrawal(restaurantId, amount, amountMinor, currencyConfig);
  }

  async findOrderPlacementProfile(restaurantId: string): Promise<Record<string, unknown> | null> {
    return this.lookup.findOrderPlacementProfile(restaurantId);
  }

  async incrementOrderCounter(restaurantId: string): Promise<number> {
    return this.lookup.incrementOrderCounter(restaurantId);
  }

  async isAddressInDeliveryBounds(
    restaurantId: string,
    coordinates: number[],
  ): Promise<boolean> {
    return this.zones.isAddressInDeliveryBounds(restaurantId, coordinates);
  }

  async findOrderOpenStatusInputs(
    restaurantId: string | Types.ObjectId,
  ): Promise<OrderOpenStatusInputs | null> {
    return this.lookup.findOrderOpenStatusInputs(restaurantId);
  }

  async getDispatchOrigin(
    restaurantId: string,
  ): Promise<{ restaurantId: string; name: string; longitude: number; latitude: number } | null> {
    return this.lookup.getDispatchOrigin(restaurantId);
  }

  countRestaurantsUsingCuisine(cuisineName: string): Promise<number> {
    return this.lookup.countRestaurantsUsingCuisine(cuisineName);
  }

  countRestaurantsUsingShopCategory(slug: string): Promise<number> {
    return this.lookup.countRestaurantsUsingShopCategory(slug);
  }

  findByUsername(username: string): Promise<RestaurantDocument | null> {
    return this.lookup.findByUsername(username);
  }

  /**
   * Resolves the active restaurant owning a per-store Clerk identity, throwing
   * when none is linked. Deactivated restaurants (isActive:false) are excluded
   * so a disabled store identity cannot authenticate or read its profile.
   */
  async findByClerkIdOrThrow(clerkId: string): Promise<RestaurantDocument> {
    return this.lookup.findByClerkIdOrThrow(clerkId);
  }

  findBySlug(slug: string): Promise<RestaurantDocument | null> {
    return this.lookup.findBySlug(slug);
  }

  async setNotificationToken(
    restaurant: RestaurantDocument,
    token?: string,
  ): Promise<void> {
    return this.availability.setNotificationToken(restaurant, token);
  }

  async updateNotificationPrefs(
    restaurantId: string,
    isOrderNotification: boolean,
    isOfferNotification: boolean,
  ): Promise<RestaurantDocument> {
    return this.availability.updateNotificationPrefs(restaurantId, isOrderNotification, isOfferNotification);
  }

  // ── discovery queries ─────────────────────────────────────────────────────

  findAll() {
    return this.lookup.findAll();
  }

  findAllAdmin() {
    return this.lookup.findAllAdmin();
  }

  async findPaginated(page = 1, limit = 10, search?: string) {
    return this.lookup.findPaginated(page, limit, search);
  }

  async findByIdOrThrow(id: string): Promise<RestaurantDocument> {
    return this.lookup.findByIdOrThrow(id);
  }

  // Null-returning variant for the public nullable `restaurant` query — stale
  // client-side ids (e.g. a cart persisted before a reseed) must not surface
  // as GraphQL errors.
  async findByIdOrNull(id: string): Promise<RestaurantDocument | null> {
    return this.lookup.findByIdOrNull(id);
  }

  // Slim header fetch for instant header paint on the mobile restaurant screen.
  // The menu is no longer embedded (it lives in the catalog collections and is
  // resolved lazily), so this query is naturally light; clients that want the
  // menu select `categories` and trigger the catalog field resolver.
  async findHeaderById(id: string): Promise<RestaurantDocument | null> {
    return this.lookup.findHeaderById(id);
  }

  async findByOwner(ownerId: string) {
    return this.lookup.findByOwner(ownerId);
  }

  // Resolve a restaurant's working zone from its GPS point. Stored
  // `restaurant.zone` is legacy data and must not drive dispatch.
  async findZoneByRestaurantLocation(
    restaurant: { location?: { coordinates?: number[] } },
  ): Promise<ZoneDocument | null> {
    return this.zones.findZoneByRestaurantLocation(restaurant);
  }

  async findZoneByPoint(coordinates?: number[]): Promise<ZoneDocument | null> {
    return this.zones.findZoneByPoint(coordinates);
  }

  // Resolve a legacy zone ObjectId for old clients that still hold an id.
  async findZoneById(id: string): Promise<ZoneDocument | null> {
    return this.zones.findZoneById(id);
  }

  async getDeliveryZoneInfo(id: string) {
    return this.zones.getDeliveryZoneInfo(id);
  }

  async nearByRestaurants(latitude: number, longitude: number, shopType?: string) {
    return this.discovery.nearByRestaurants(latitude, longitude, shopType);
  }

  async commissionRate(page = 1, limit = 10) {
    return this.wallet.commissionRate(page, limit);
  }

  // ── mutations ─────────────────────────────────────────────────────────────

  async create(input: RestaurantInput, ownerId: string): Promise<RestaurantDocument> {
    return this.profile.create(input, ownerId);
  }

  async delete(id: string): Promise<RestaurantDocument> {
    return this.profile.delete(id);
  }

  async hardDelete(id: string): Promise<boolean> {
    return this.profile.hardDelete(id);
  }

  async edit(input: RestaurantProfileInput): Promise<RestaurantDocument> {
    return this.profile.edit(input);
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
    return this.profile.updateDeliveryBoundsAndLocation(id, boundType, location, bounds, circleBounds, address, postCode, city);
  }

  async updateDelivery(
    id: string,
    minDeliveryFee?: number,
    deliveryDistance?: number,
    deliveryFee?: number,
  ) {
    return this.profile.updateDelivery(id, minDeliveryFee, deliveryDistance, deliveryFee);
  }

  async updateBussinessDetails(id: string, bussinessDetails: BussinessDetailsInput) {
    return this.profile.updateBussinessDetails(id, bussinessDetails);
  }

  async duplicate(id: string, ownerId: string): Promise<RestaurantDocument> {
    return this.profile.duplicate(id, ownerId);
  }

  async updateCommission(id: string, commissionRate: number): Promise<RestaurantDocument> {
    return this.profile.updateCommission(id, commissionRate);
  }

  async updateTimings(
    id: string,
    openingTimes: Array<{ day?: string; times?: Array<{ startTime?: string | string[]; endTime?: string | string[] }> }>,
  ): Promise<RestaurantDocument> {
    return this.profile.updateTimings(id, openingTimes);
  }

  async updateDeliveryOptions(restId: string, pickup: boolean, delivery: boolean): Promise<RestaurantDocument> {
    return this.profile.updateDeliveryOptions(restId, pickup, delivery);
  }

  async findByClerkId(clerkId: string): Promise<RestaurantDocument | null> {
    return this.lookup.findByClerkId(clerkId);
  }

  /**
   * Flips a store's manual availability switch.
   *
   * When turning the store OFF (becoming unavailable), an optional
   * `pauseMinutes` schedules an automatic resume: `unavailableUntil` is set and
   * the `autoResumeStores` cron flips it back on once that time passes. Passing
   * no/zero `pauseMinutes` pauses indefinitely (until manually re-enabled).
   * Turning the store ON always clears any pending auto-resume.
   */
  async toggleAvailability(
    clerkId: string,
    pauseMinutes?: number,
  ): Promise<RestaurantDocument> {
    return this.availability.toggleAvailability(clerkId, pauseMinutes);
  }

  /**
   * Every minute: re-enable any store whose timed pause has elapsed.
   * Stores paused indefinitely (unavailableUntil null) are left untouched.
   */
  async autoResumeStores(): Promise<void> {
    return this.availability.autoResumeStores();
  }

  async saveNotificationToken(
    clerkId: string,
    token: string | undefined,
    isEnabled: boolean | undefined,
  ): Promise<RestaurantDocument> {
    return this.availability.saveNotificationToken(clerkId, token, isEnabled);
  }

  async clearNotificationToken(token: string): Promise<number> {
    return this.availability.clearNotificationToken(token);
  }

  async recentOrderRestaurants(
    latitude: number,
    longitude: number,
  ): Promise<any[]> {
    return this.discovery.recentOrderRestaurants(latitude, longitude);
  }

  async mostOrderedRestaurants(
    latitude: number,
    longitude: number,
    shopType?: string,
    page = 1,
    limit = 20,
  ): Promise<any[]> {
    return this.discovery.mostOrderedRestaurants(latitude, longitude, shopType, page, limit);
  }

  async recentOrderRestaurantsPreview(
    latitude: number,
    longitude: number,
  ): Promise<RestaurantPreviewModel[]> {
    return this.discovery.recentOrderRestaurantsPreview(latitude, longitude);
  }

  async mostOrderedRestaurantsPreview(
    latitude: number,
    longitude: number,
    shopType?: string,
    page = 1,
    limit = 20,
  ): Promise<RestaurantPreviewModel[]> {
    return this.discovery.mostOrderedRestaurantsPreview(latitude, longitude, shopType, page, limit);
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
    return this.discovery.topRatedRestaurantsPreview(latitude, longitude, shopType, page, limit);
  }

  async nearByRestaurantsPreviewResult(
    latitude: number,
    longitude: number,
    shopType?: string,
    page?: number,
    limit?: number,
  ) {
    return this.discovery.nearByRestaurantsPreviewResult(latitude, longitude, shopType, page, limit);
  }

  // ── reviews ────────────────────────────────────────────────────────────────

  async reviewsByRestaurant(restaurantId: string) {
    return this.discovery.reviewsByRestaurant(restaurantId);
  }

}
