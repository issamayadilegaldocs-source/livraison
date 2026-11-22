import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';
import { Offer, OfferDocument } from './offer.schema';
import { Restaurant, RestaurantDocument } from '../restaurants/restaurant.schema';
import { User, UserDocument } from '../users/user.schema';
import { OfferInput } from './dto/offer.input';
import { NotificationsService } from '../notifications/notifications.service';
import { Money, MoneyCurrency } from '../common/money/money';

const ZONE_NOTIFY_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6h per restaurant
const DEFAULT_FALLBACK_RADIUS_KM = 5;
const EARTH_RADIUS_KM = 6378.1;
const MAX_ZONE_RECIPIENTS = 5000;

type RestaurantLean = RestaurantDocument & { _id: Types.ObjectId };

@Injectable()
export class OffersService {
  private readonly logger = new Logger(OffersService.name);

  constructor(
    @InjectModel(Offer.name) private readonly offerModel: Model<OfferDocument>,
    @InjectModel(Restaurant.name)
    private readonly restaurantModel: Model<RestaurantDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ── Reads ──────────────────────────────────────────────────────────────────

  async findAll(): Promise<any[]> {
    const offers = await this.offerModel
      .find()
      .sort({ createdAt: -1 })
      .populate('restaurant', 'name image slug')
      .lean()
      .exec();
    return offers.map((o) => this.decorate(o));
  }

  async findByRestaurant(restaurantId: string): Promise<any[]> {
    const offers = await this.offerModel
      .find({ restaurant: new Types.ObjectId(restaurantId) })
      .sort({ createdAt: -1 })
      .populate('restaurant', 'name image slug')
      .lean()
      .exec();
    return offers.map((o) => this.decorate(o));
  }

  async myOffers(clerkId: string): Promise<any[]> {
    const restaurant = await this.resolveRestaurant({ clerkId });
    return this.findByRestaurant(String(restaurant._id));
  }

  /** Public: only offers that are currently active for a restaurant. */
  async activeRestaurantOffers(restaurantId: string): Promise<any[]> {
    const now = new Date();
    const offers = await this.offerModel
      .find({
        restaurant: new Types.ObjectId(restaurantId),
        enabled: { $ne: false },
        startsAt: { $lte: now },
        endsAt: { $gte: now },
      })
      .sort({ startsAt: -1 })
      .lean()
      .exec();
    return offers.map((o) => this.decorate(o));
  }

  // ── Store (vendor) writes ────────────────────────────────────────────────────

  async createOffer(
    params: { clerkId?: string; restaurantId?: string },
    input: OfferInput,
    idempotencyKey?: string,
  ): Promise<any> {
    const restaurant = await this.resolveRestaurant(params);

    if (idempotencyKey) {
      const existing = await this.offerModel
        .findOne({ idempotencyKey })
        .populate('restaurant', 'name image slug')
        .lean()
        .exec();
      if (existing) return this.decorate(existing);
    }

    const { startsAt, endsAt } = this.validateWindow(input);
    this.validateValue(input);
    await this.assertNoOverlap(String(restaurant._id), startsAt, endsAt);

    const isItems = input.scope === 'ITEMS';
    let created: OfferDocument;
    try {
      created = await this.offerModel.create({
        restaurant: restaurant._id,
        title: input.title,
        type: input.type,
        value: input.value,
        startsAt,
        endsAt,
        scope: input.scope ?? 'CART',
        targetFoodIds: isItems ? input.targetFoodIds ?? [] : [],
        targetCategoryIds: isItems ? input.targetCategoryIds ?? [] : [],
        minOrderAmount: input.minOrderAmount,
        maxDiscount: input.maxDiscount,
        enabled: true,
        idempotencyKey,
      });
    } catch (err: any) {
      if (err?.code === 11000 && idempotencyKey) {
        const existing = await this.offerModel
          .findOne({ idempotencyKey })
          .populate('restaurant', 'name image slug')
          .lean()
          .exec();
        if (existing) return this.decorate(existing);
      }
      throw err;
    }

    // Best-effort zone marketing push; never blocks offer creation.
    this.notifyZoneCustomers(created, restaurant).catch((err) =>
      this.logger.warn(`[offers] zone notify failed: ${err?.message}`),
    );

    const populated = await this.offerModel
      .findById(created._id)
      .populate('restaurant', 'name image slug')
      .lean()
      .exec();
    return this.decorate(populated);
  }

  async editOffer(
    params: { clerkId?: string; restaurantId?: string },
    input: OfferInput,
  ): Promise<any> {
    if (!input._id) throw new BadRequestException('_id is required');
    const restaurant = await this.resolveRestaurant(params);
    const existing = await this.offerModel
      .findOne({ _id: input._id, restaurant: restaurant._id })
      .exec();
    if (!existing) throw new NotFoundException('Offer not found for this restaurant');

    const { startsAt, endsAt } = this.validateWindow(input);
    this.validateValue(input);
    await this.assertNoOverlap(String(restaurant._id), startsAt, endsAt, input._id);

    const isItems = input.scope === 'ITEMS';
    existing.title = input.title;
    existing.type = input.type;
    existing.value = input.value;
    existing.startsAt = startsAt;
    existing.endsAt = endsAt;
    existing.scope = input.scope ?? 'CART';
    existing.targetFoodIds = isItems ? input.targetFoodIds ?? [] : [];
    existing.targetCategoryIds = isItems ? input.targetCategoryIds ?? [] : [];
    existing.minOrderAmount = input.minOrderAmount;
    existing.maxDiscount = input.maxDiscount;
    await existing.save();

    const populated = await this.offerModel
      .findById(existing._id)
      .populate('restaurant', 'name image slug')
      .lean()
      .exec();
    return this.decorate(populated);
  }

  /** Vendor cancels their own offer (soft: stops applying and showing). */
  async cancelOffer(clerkId: string, offerId: string): Promise<boolean> {
    const restaurant = await this.resolveRestaurant({ clerkId });
    const res = await this.offerModel
      .updateOne(
        { _id: offerId, restaurant: restaurant._id },
        { $set: { enabled: false } },
      )
      .exec();
    if (res.matchedCount === 0)
      throw new NotFoundException('Offer not found for this restaurant');
    return true;
  }

  // ── Admin moderation ─────────────────────────────────────────────────────────

  async moderateOffer(offerId: string, enabled: boolean): Promise<any> {
    const updated = await this.offerModel
      .findByIdAndUpdate(offerId, { $set: { enabled } }, { new: true })
      .populate('restaurant', 'name image slug')
      .lean()
      .exec();
    if (!updated) throw new NotFoundException('Offer not found');
    return this.decorate(updated);
  }

  async deleteOffer(offerId: string): Promise<boolean> {
    const deleted = await this.offerModel.findByIdAndDelete(offerId).exec();
    if (!deleted) throw new NotFoundException('Offer not found');
    return true;
  }

  // ── Checkout integration ─────────────────────────────────────────────────────

  /** The single offer currently in force for a restaurant (or null). */
  async resolveActiveOffer(restaurantId: string): Promise<OfferDocument | null> {
    const now = new Date();
    return this.offerModel
      .findOne({
        restaurant: new Types.ObjectId(restaurantId),
        enabled: { $ne: false },
        startsAt: { $lte: now },
        endsAt: { $gte: now },
      })
      .sort({ startsAt: -1 })
      .lean()
      .exec() as Promise<OfferDocument | null>;
  }

  /**
   * Compute the discount an active offer grants. `items` are the built order
   * items (with variation.price, addons[].options[].price, quantity, food id);
   * `subtotal` is the items-only cart total. `restaurant` (optional, lean) lets
   * ITEMS-scoped offers expand target categories to their food ids.
   */
  computeDiscount(
    offer: Pick<
      Offer,
      | 'type'
      | 'value'
      | 'scope'
      | 'targetFoodIds'
      | 'targetCategoryIds'
      | 'minOrderAmount'
      | 'maxDiscount'
    >,
    items: any[],
    subtotal: number,
    categoryFoodIds: string[] = [],
    currencyConfig: MoneyCurrency = {},
  ): number {
    const subtotalMoney = Money.fromDecimal(subtotal, currencyConfig);
    if (
      offer.minOrderAmount &&
      subtotalMoney.compare(Money.fromDecimal(offer.minOrderAmount, currencyConfig)) < 0
    )
      return 0;

    const base = this.discountBase(offer, items, subtotal, categoryFoodIds);
    if (base <= 0) return 0;
    const baseMoney = Money.fromDecimal(base, currencyConfig);

    let discount =
      offer.type === 'PERCENTAGE'
        ? baseMoney.multiply(String(offer.value / 100))
        : this.minMoney(Money.fromDecimal(offer.value, currencyConfig), baseMoney);

    if (offer.maxDiscount != null)
      discount = this.minMoney(discount, Money.fromDecimal(offer.maxDiscount, currencyConfig));
    discount = this.minMoney(discount, subtotalMoney); // never exceed the cart subtotal

    return discount.toNumber();
  }

  private minMoney(a: Money, b: Money): Money {
    return a.compare(b) <= 0 ? a : b;
  }

  private discountBase(
    offer: Pick<Offer, 'scope' | 'targetFoodIds' | 'targetCategoryIds'>,
    items: any[],
    subtotal: number,
    categoryFoodIds: string[] = [],
  ): number {
    if (offer.scope !== 'ITEMS') return subtotal;

    const foodIds = new Set((offer.targetFoodIds ?? []).map(String));
    // Foods belonging to the offer's target categories are resolved by the
    // caller (Orders, via CatalogService) so Offers never reads the catalog.
    for (const id of categoryFoodIds) foodIds.add(String(id));
    if (foodIds.size === 0) return 0;

    return items
      .filter((i) => foodIds.has(String(i.food)))
      .reduce((sum, i) => sum + this.lineTotal(i), 0);
  }

  private lineTotal(item: any): number {
    const varPrice = item.variation?.price ?? 0;
    const addonTotal = (item.addons ?? []).reduce(
      (aSum: number, addon: any) =>
        aSum +
        (addon.options ?? []).reduce(
          (oSum: number, opt: any) => oSum + (opt.price ?? 0),
          0,
        ),
      0,
    );
    return (varPrice + addonTotal) * (item.quantity ?? 1);
  }

  // ── Lifecycle / housekeeping ─────────────────────────────────────────────────

  /**
   * Derived `active` is the source of truth at read/checkout time; this hourly
   * sweep just flips expired offers to disabled so they stop cluttering lists.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async deactivateExpiredOffers(): Promise<void> {
    const res = await this.offerModel
      .updateMany(
        { enabled: { $ne: false }, endsAt: { $lt: new Date() } },
        { $set: { enabled: false } },
      )
      .exec();
    if (res.modifiedCount)
      this.logger.log(`[offers] deactivated ${res.modifiedCount} expired offer(s)`);
  }

  // ── Zone notification ────────────────────────────────────────────────────────

  private async notifyZoneCustomers(
    offer: OfferDocument,
    restaurant: RestaurantLean,
  ): Promise<void> {
    // Per-restaurant cooldown so many offers don't spam the same customers.
    const cutoff = new Date(Date.now() - ZONE_NOTIFY_COOLDOWN_MS);
    const recent = await this.offerModel
      .findOne({
        restaurant: restaurant._id,
        _id: { $ne: offer._id },
        lastNotifiedAt: { $gte: cutoff },
      })
      .lean()
      .exec();
    if (recent) {
      this.logger.log(
        `[offers] zone notify skipped (cooldown) for restaurant ${restaurant._id}`,
      );
      return;
    }

    // Start the cooldown up front so a partial failure doesn't trigger a retry storm.
    await this.offerModel
      .updateOne({ _id: offer._id }, { $set: { lastNotifiedAt: new Date() } })
      .exec();

    const recipients = await this.resolveZoneCustomers(restaurant);
    if (!recipients.length) {
      this.logger.log(
        `[offers] no consenting zone customers for restaurant ${restaurant._id}`,
      );
      return;
    }

    const shopName = (restaurant as any).name ?? 'A shop near you';
    const title = `🎉 ${shopName} has a new deal`;
    const body =
      offer.type === 'PERCENTAGE'
        ? `${offer.value}% off${offer.title ? ` — ${offer.title}` : ''}. Order while it lasts!`
        : `${offer.value} off${offer.title ? ` — ${offer.title}` : ''}. Order while it lasts!`;

    await this.notificationsService.broadcastPush(recipients, title, body, {
      type: 'SHOP_OFFER',
      offerId: String(offer._id),
      restaurantId: String(restaurant._id),
    });
    this.logger.log(
      `[offers] zone offer push fanned out to ${recipients.length} customer(s) for restaurant ${restaurant._id}`,
    );
  }

  private async resolveZoneCustomers(
    restaurant: RestaurantLean,
  ): Promise<{ userId: string; userType: string }[]> {
    const geoFilter = this.zoneGeoFilter(restaurant);
    if (!geoFilter) return [];

    const users = await this.userModel
      .find(
        {
          isActive: { $ne: false },
          isOfferNotification: { $ne: false },
          clerkId: { $exists: true, $ne: null },
          ...geoFilter,
        },
        'clerkId',
      )
      .limit(MAX_ZONE_RECIPIENTS)
      .lean()
      .exec();

    return users
      .filter((u: any) => u.clerkId)
      .map((u: any) => ({ userId: String(u.clerkId), userType: 'CUSTOMER' }));
  }

  private zoneGeoFilter(restaurant: any): Record<string, unknown> | null {
    const bounds = restaurant.deliveryBounds;
    if (bounds?.coordinates?.length) {
      return {
        'addresses.location': {
          $geoWithin: {
            $geometry: { type: 'Polygon', coordinates: bounds.coordinates },
          },
        },
      };
    }
    const coords = restaurant.location?.coordinates;
    if (coords?.length === 2) {
      const [lng, lat] = coords;
      const radiusKm =
        restaurant.deliveryInfo?.deliveryDistance || DEFAULT_FALLBACK_RADIUS_KM;
      return {
        'addresses.location': {
          $geoWithin: { $centerSphere: [[lng, lat], radiusKm / EARTH_RADIUS_KM] },
        },
      };
    }
    return null;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private async resolveRestaurant(params: {
    clerkId?: string;
    restaurantId?: string;
  }): Promise<RestaurantLean> {
    const filter = params.clerkId
      ? { clerkId: params.clerkId }
      : { _id: new Types.ObjectId(params.restaurantId) };
    const restaurant = await this.restaurantModel.findOne(filter).lean().exec();
    if (!restaurant) throw new NotFoundException('Restaurant not found');
    return restaurant as unknown as RestaurantLean;
  }

  private validateWindow(input: OfferInput): { startsAt: Date; endsAt: Date } {
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()))
      throw new BadRequestException('Invalid offer dates');
    if (endsAt <= startsAt)
      throw new BadRequestException('Offer end must be after its start');
    if (endsAt <= new Date())
      throw new BadRequestException('Offer end must be in the future');
    return { startsAt, endsAt };
  }

  private validateValue(input: OfferInput): void {
    if (input.value <= 0)
      throw new BadRequestException('Offer value must be positive');
    if (input.type === 'PERCENTAGE' && input.value > 100)
      throw new BadRequestException('Percentage offer cannot exceed 100');
  }

  private async assertNoOverlap(
    restaurantId: string,
    startsAt: Date,
    endsAt: Date,
    excludeId?: string,
  ): Promise<void> {
    const filter: Record<string, unknown> = {
      restaurant: new Types.ObjectId(restaurantId),
      enabled: { $ne: false },
      startsAt: { $lte: endsAt },
      endsAt: { $gte: startsAt },
    };
    if (excludeId) filter._id = { $ne: new Types.ObjectId(excludeId) };
    const clash = await this.offerModel.findOne(filter).lean().exec();
    if (clash)
      throw new BadRequestException(
        'Another offer already overlaps this time window for this restaurant',
      );
  }

  private decorate(offer: any): any {
    if (!offer) return offer;
    const now = Date.now();
    const active =
      offer.enabled !== false &&
      new Date(offer.startsAt).getTime() <= now &&
      now <= new Date(offer.endsAt).getTime();

    const r = offer.restaurant;
    const restaurant =
      r && typeof r === 'object' && r._id
        ? { _id: String(r._id), name: r.name, image: r.image, slug: r.slug }
        : r
          ? { _id: String(r) }
          : undefined;

    return { ...offer, active, restaurant };
  }
}
