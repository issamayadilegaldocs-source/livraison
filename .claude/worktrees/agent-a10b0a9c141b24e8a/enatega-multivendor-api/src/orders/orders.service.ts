import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';
import { Configuration, ConfigurationDocument } from '../configuration/configuration.schema';
import { Order, OrderDocument } from './order.schema';
import { Review, ReviewDocument } from './review.schema';
import { Rider, RiderDocument } from '../riders/rider.schema';
import { UsersService } from '../users/users.service';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { CatalogService } from '../restaurants/catalog.service';
import { RidersService } from '../riders/riders.service';
import { OrderItemInput, PlaceOrderAddressInput } from './dto/place-order.input';
import { ReviewInput } from './dto/review-order.input';
import { AppPubSub, PUB_SUB } from '../pubsub/pubsub.module';
import { Events } from '../subscriptions/events';
import { TrackingService } from '../tracking/tracking.service';
import { OffersService } from '../offers/offers.service';
import { DeliveryEstimationService } from '../delivery-estimation/delivery-estimation.service';
import {
  computeDeliveryFee,
  computeDeliveryBonus,
  haversineKm,
  normalizeFee,
  DeliveryFeeConfig,
} from '../delivery-estimation/delivery-fee';
import { NotificationsService } from '../notifications/notifications.service';
import { DispatchService, DispatchReason } from '../dispatch/dispatch.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { CouponsService } from '../coupons/coupons.service';
import { CustomerWalletService } from '../customer-wallet/customer-wallet.service';
import { ConfigService } from '@nestjs/config';
import { evaluateOpen } from '../common/opening-hours.util';
import { ZonesService } from '../zones/zones.service';
import { Money } from '../common/money/money';
import {
  PAYMENT_ATTEMPT_AUDIT_PORT,
  PaymentAttemptAuditPort,
} from '../payments/payment-attempts.port';

const NEARBY_RIDER_RADIUS_KM = 8;
const DEFAULT_TIMEZONE_FALLBACK = 'UTC';

// Payment methods whose order must be paid online before it enters the
// fulfillment pipeline (the restaurant is only notified once payment succeeds).
const ONLINE_PAYMENT_METHODS = ['FLOUCI'];

// Allowed admin-driven order status transitions. Admin `updateStatus` is a manual
// override, but it must never jump across the pipeline or move backward, which would
// corrupt the fulfillment lifecycle and bypass wallet crediting. Target DELIVERED is
// intentionally excluded here: it is routed through forceCompleteOrder so the dual
// confirmation + walletCredited guard still applies.
const ORDER_STATUS_TRANSITIONS: Record<string, string[]> = {
  SCHEDULED: ['PENDING', 'CANCELLED'],
  PENDING: ['ACCEPTED', 'CANCELLED', 'CANCELLEDBYREST'],
  ACCEPTED: ['PREPARED', 'AWAITING_RIDER', 'ASSIGNED', 'CANCELLED', 'CANCELLEDBYREST'],
  PREPARED: ['AWAITING_RIDER', 'ASSIGNED', 'CANCELLED', 'CANCELLEDBYREST'],
  AWAITING_RIDER: ['ASSIGNED', 'ACCEPTED', 'CANCELLED', 'CANCELLEDBYREST'],
  ASSIGNED: ['PICKED', 'CANCELLED', 'CANCELLEDBYREST'],
  // DELIVERED is intentionally absent here — it is intercepted earlier in
  // updateStatus() and routed through forceCompleteOrder regardless of `from`.
  PICKED: ['ARRIVED', 'CANCELLED'],
  ARRIVED: ['CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
  CANCELLEDBYREST: [],
};

const POPULATE_RESTAURANT = {
  path: 'restaurant',
  select: '_id name image address slug shopType location',
};
const POPULATE_USER = { path: 'user', select: '_id name phone email clerkId' };
const POPULATE_RIDER = { path: 'rider', select: '_id name username phone available image' };
const POPULATE_REVIEW = {
  path: 'review',
  select: '_id rating description isActive createdAt updatedAt',
};
const POPULATE_ZONE = { path: 'zone', select: '_id title' };

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Review.name) private readonly reviewModel: Model<ReviewDocument>,
    @InjectModel(Rider.name) private readonly riderModel: Model<RiderDocument>,
    @InjectModel(Configuration.name)
    private readonly configurationModel: Model<ConfigurationDocument>,
    @Inject(PUB_SUB) private readonly pubSub: AppPubSub,
    private readonly usersService: UsersService,
    private readonly restaurantsService: RestaurantsService,
    private readonly ridersService: RidersService,
    private readonly trackingService: TrackingService,
    private readonly offersService: OffersService,
    private readonly deliveryEstimationService: DeliveryEstimationService,
    private readonly notificationsService: NotificationsService,
    private readonly dispatchService: DispatchService,
    private readonly loyaltyService: LoyaltyService,
    private readonly couponsService: CouponsService,
    private readonly customerWalletService: CustomerWalletService,
    private readonly config: ConfigService,
    private readonly zonesService: ZonesService,
    // Optional so positional unit tests can omit it; OrdersModule always wires
    // RestaurantsModule (which exports CatalogService), so it is present in
    // production and required for order placement.
    @Optional()
    private readonly catalogService?: CatalogService,
    // Optional so positional unit tests can omit it; OrdersModule always wires
    // PaymentAttemptsModule, so it is present in production.
    @Optional()
    @Inject(PAYMENT_ATTEMPT_AUDIT_PORT)
    private readonly paymentAttempts?: PaymentAttemptAuditPort,
  ) {}

  // ── helpers ───────────────────────────────────────────────────────────────

  /**
   * Minimal actor-identity lookup for subscription ownership checks — avoids
   * the full population `findOrderOrThrow` does since only the raw refs
   * are needed.
   */
  async getOrderActorRefs(
    id: string,
  ): Promise<{ userId?: string; restaurantId?: string; riderId?: string; zoneId?: string } | null> {
    const order = await this.orderModel
      .findById(id, 'user restaurant rider zone')
      .lean()
      .exec();
    if (!order) return null;
    return {
      userId: (order as any).user ? String((order as any).user) : undefined,
      restaurantId: (order as any).restaurant ? String((order as any).restaurant) : undefined,
      riderId: (order as any).rider ? String((order as any).rider) : undefined,
      zoneId: (order as any).zone ? String((order as any).zone) : undefined,
    };
  }

  private async publishOrderStatusChanged(orderId: string): Promise<void> {
    const order = await this.findOrderOrThrow(orderId);
    const userId = (order as any).user?._id?.toString() ?? (order as any).user?.toString();
    const restaurantId =
      (order as any).restaurant?._id?.toString() ?? (order as any).restaurant?.toString();
    await this.pubSub.publish(Events.ORDER_STATUS_CHANGED, {
      [Events.ORDER_STATUS_CHANGED]: { orderId, userId, restaurantId, origin: 'status', order },
    });
  }

  /** Best-effort audit append — a failed write never blocks the transition it records. */
  private async pushStatusHistory(
    orderId: string,
    status: string,
    actor: 'ADMIN' | 'RIDER' | 'STORE' | 'CUSTOMER' | 'SYSTEM',
    actorId?: string,
  ): Promise<void> {
    const at = new Date().toISOString();
    try {
      await this.orderModel
        .findByIdAndUpdate(orderId, {
          $push: {
            statusHistory: { status, at, actor, actorId },
          },
        })
        .exec();
    } catch (err) {
      this.logger.warn(`[statusHistory] failed to record ${status} for order ${orderId}: ${err}`);
    }
    // Live admin ops timeline (operationsFeed subscription) — best-effort,
    // side-channel projection of the statusHistory append above; a read/publish
    // failure here must never affect the underlying status transition.
    this.publishOperationsFeedItem(orderId, status, actor, actorId, at).catch(() => {});
  }

  /** See pushStatusHistory — separate method so a slow/failed enrichment read never delays it. */
  private async publishOperationsFeedItem(
    orderId: string,
    status: string,
    actor: string,
    actorId: string | undefined,
    at: string,
  ): Promise<void> {
    const enriched = await this.orderModel
      .findById(orderId, 'orderId rider restaurant')
      .populate({ path: 'rider', select: '_id name' })
      .populate({ path: 'restaurant', select: '_id name' })
      .lean()
      .exec();
    await this.pubSub.publish(Events.OPERATIONS_FEED_ITEM, {
      [Events.OPERATIONS_FEED_ITEM]: {
        orderId,
        orderDisplayId: (enriched as any)?.orderId,
        status,
        actor,
        actorId,
        at,
        riderName: (enriched as any)?.rider?.name,
        restaurantName: (enriched as any)?.restaurant?.name,
      },
    });
  }

  private async isArrivedStepRequired(): Promise<boolean> {
    const config = await this.configurationModel
      .findOne({}, 'requireArrivedStep')
      .lean()
      .exec();
    return (config as any)?.requireArrivedStep ?? true;
  }

  /**
   * If enforceArrivalGps is on and both the delivery address and the rider's
   * last-known live location (tracking's per-order Redis key) are available,
   * reject ARRIVED when the rider is further than arrivalGpsRadiusMeters away.
   * Either location missing skips the check rather than blocking the rider —
   * Redis presence/GPS accuracy is best-effort, not a hard dependency.
   */
  private async validateArrivalProximity(
    orderId: string,
  ): Promise<{ latitude: number; longitude: number } | undefined> {
    const config = await this.configurationModel
      .findOne({}, 'enforceArrivalGps arrivalGpsRadiusMeters')
      .lean()
      .exec();
    const riderLocation = await this.trackingService.getLatestLocationForOrder(orderId);
    if (!config || !(config as any).enforceArrivalGps || !riderLocation) {
      return riderLocation ? { latitude: riderLocation.latitude, longitude: riderLocation.longitude } : undefined;
    }

    const order = await this.orderModel.findById(orderId, 'deliveryAddress').lean().exec();
    const coords = (order as any)?.deliveryAddress?.location?.coordinates;
    if (!Array.isArray(coords) || coords.length !== 2) {
      return { latitude: riderLocation.latitude, longitude: riderLocation.longitude };
    }

    const [destLon, destLat] = coords;
    const distanceMeters =
      haversineKm(riderLocation.latitude, riderLocation.longitude, destLat, destLon) * 1000;
    const radiusMeters: number = (config as any).arrivalGpsRadiusMeters ?? 100;
    if (distanceMeters > radiusMeters) {
      throw new BadRequestException(
        `You must be within ${radiusMeters}m of the delivery address to mark this order as arrived (currently ~${Math.round(distanceMeters)}m away)`,
      );
    }
    return { latitude: riderLocation.latitude, longitude: riderLocation.longitude };
  }

  private async resolveUserMongoId(clerkId: string): Promise<Types.ObjectId> {
    return this.usersService.resolveMongoIdByClerkId(clerkId);
  }

  async resolveRestaurantMongoId(clerkId: string): Promise<string> {
    return this.restaurantsService.resolveMongoIdByClerkId(clerkId);
  }

  private withPopulate<T>(query: any): any {
    return query
      .populate(POPULATE_RESTAURANT)
      .populate(POPULATE_USER)
      .populate(POPULATE_RIDER)
      .populate(POPULATE_REVIEW)
      .populate(POPULATE_ZONE);
  }

  private async findOrderOrThrow(id: string): Promise<OrderDocument> {
    const order = await this.withPopulate(this.orderModel.findById(id)).lean().exec();
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return order as unknown as OrderDocument;
  }

  // ── placeOrder ────────────────────────────────────────────────────────────

  async placeOrder(
    userId: string,
    restaurantId: string,
    orderInput: OrderItemInput[],
    paymentMethod: string,
    tipping: number,
    taxationAmount: number,
    address: PlaceOrderAddressInput,
    orderDate: string,
    isPickedUp: boolean,
    deliveryCharges: number,
    instructions?: string,
    couponCode?: string,
    loyaltyPointsToRedeem = 0,
    isExpress = false,
    idempotencyKey?: string,
  ): Promise<OrderDocument> {
    // A retried placeOrder (reconnect after a network drop, accidental
    // double-submit) with the same Idempotency-Key must return the order
    // that was already created, not charge/create a second time. Checked
    // before any side effect below (catalog read, coupon claim, wallet
    // debit, order creation).
    if (idempotencyKey) {
      const existing = await this.orderModel
        .findOne({ placementIdempotencyKey: idempotencyKey })
        .lean()
        .exec();
      if (existing) return this.findOrderOrThrow(String((existing as any)._id));
    }

    const [restaurant, userMongoId] = await Promise.all([
      this.restaurantsService.findOrderPlacementProfile(restaurantId),
      this.resolveUserMongoId(userId),
    ]);
    if (!restaurant) throw new NotFoundException('Restaurant not found');
    if (!(restaurant as any).isActive)
      throw new BadRequestException('Restaurant is not accepting orders');
    // Manual availability switch: a store that has paused itself does not
    // receive new orders, even within its opening hours.
    if ((restaurant as any).isAvailable === false)
      throw new BadRequestException('Restaurant is not accepting orders right now');

    const nowForScheduleCheck = new Date();
    const requestedDateForScheduleCheck = new Date(orderDate);
    const isScheduledOrder =
      Number.isFinite(requestedDateForScheduleCheck.getTime()) &&
      requestedDateForScheduleCheck.getTime() > nowForScheduleCheck.getTime() + 60_000;

    // Assert the restaurant is open at the relevant moment. For ASAP orders that
    // is now; for scheduled orders it is the scheduled slot — catching "you
    // scheduled for a time we're closed" immediately (path a), with
    // activateScheduledOrders re-checking as the safety net (path b).
    this.assertRestaurantOpenAt(
      restaurant as any,
      isScheduledOrder ? requestedDateForScheduleCheck : nowForScheduleCheck,
    );

    // Catalog (foods/addons/options) now lives in its own collections; load the
    // restaurant's catalog snapshot to price and snapshot the cart items.
    const catalogService = this.catalogService;
    if (!catalogService) throw new Error('CatalogService is required for order placement');
    const catalog = await catalogService.getOrderPlacementCatalog(restaurantId);
    const items = orderInput.map((input) => this.buildOrderItem(input, catalog));

    // Delivery coordinates are needed early: the server recomputes the delivery
    // fee (below) rather than trusting the client-supplied `deliveryCharges`.
    const coordinates = this.resolveDeliveryCoordinates(address);

    // Loyalty points redemption + express surcharge + delivery-fee pricing —
    // single config read. The delivery pricing knobs (costType/deliveryRate/…)
    // let the API recompute the fee server-side instead of trusting the payload.
    const config = await this.configurationModel
      .findOne(
        {},
        'loyaltyEnabled loyaltyPointsRedemptionRate expressEnabled expressSurcharge currency currencyDecimalDigits costType deliveryRate baseDeliveryFee baseDeliveryDistance deliveryFeeMinimum deliveryFeeMaximum deliveryRoundToNearest serviceFeeEnabled serviceFeeRate serviceFeeMinimum serviceFeeMaximum deliveryBonusEnabled deliveryBonusPerKm deliveryBonusFreeDistance deliveryBonusMax',
      )
      .lean()
      .exec();
    const moneyConfig = this.moneyCurrencyConfig(config);
    const subtotalMoney = this.orderItemsTotalMoney(items, moneyConfig);
    const subtotal = subtotalMoney.toNumber();

    // ── Server-authoritative delivery fee ─────────────────────────────────────
    // Ignore whatever `deliveryCharges` the client sent. Pickup orders pay no
    // delivery; delivered orders are priced from the config model and the
    // straight-line distance to the restaurant. When coordinates are missing we
    // fall back to the flat `deliveryRate` (the client's own fallback), never to
    // the client-supplied number.
    const authoritativeDeliveryCharges = this.resolveAuthoritativeDeliveryCharges(
      restaurant,
      config,
      coordinates,
      isPickedUp,
    );

    // Platform-funded rider bonus default (distance-based). Not part of the
    // customer total; added to the rider's earnings at settlement. An admin can
    // override it per order via setDeliveryBonus.
    const deliveryDistanceKm = this.resolveDeliveryDistanceKm(restaurant, coordinates, isPickedUp);
    const deliveryBonusAmount = isPickedUp
      ? 0
      : computeDeliveryBonus(config as any, deliveryDistanceKm ?? 0);

    // ── Server-authoritative tax ──────────────────────────────────────────────
    // Tax is the restaurant's configured rate applied to the catalog-priced
    // subtotal — never the client-supplied `taxationAmount`. No configured rate
    // means no tax (a client can no longer inject a tax, negative or otherwise).
    const restaurantTaxRate = Number((restaurant as any).tax);
    const authoritativeTaxMoney =
      Number.isFinite(restaurantTaxRate) && restaurantTaxRate > 0
        ? subtotalMoney.multiply(String(restaurantTaxRate / 100))
        : this.zeroMoney(moneyConfig);

    // Server-authoritative discount: apply the restaurant's currently-active
    // time-boxed offer (if any) to the items subtotal, before delivery/tip/tax.
    const activeOffer = await this.offersService.resolveActiveOffer(restaurantId);
    const offerCategoryFoodIds = (activeOffer as any)?.targetCategoryIds?.length
      ? await catalogService.getFoodIdsForCategories(
          restaurantId,
          (activeOffer as any).targetCategoryIds.map(String),
        )
      : [];
    const offerDiscount = activeOffer
      ? this.offersService.computeDiscount(
          activeOffer as any,
          items,
          subtotal,
          offerCategoryFoodIds,
          moneyConfig,
        )
      : 0;
    // Defence in depth: OffersService already caps its discount at the subtotal,
    // but never let a discount larger than the cart be persisted here either, so
    // discountAmount can never exceed the items regardless of offer-logic bugs.
    const offerDiscountMoney = this.minMoney(
      Money.fromDecimal(offerDiscount, moneyConfig),
      subtotalMoney,
    );

    // Coupon (flat discount), applied after the offer and before loyalty. The
    // resolver forwards the raw code; validation/scoping lives in CouponsService.
    // A usage-limited coupon is *claimed* atomically here so a leaked single-use
    // code can't be farmed and concurrent placements can't both redeem it; the
    // claimed id is tracked so it can be released if the order rolls back.
    let couponDiscountMoney = this.zeroMoney(moneyConfig);
    let appliedCouponCode: string | undefined;
    let claimedCouponId: Types.ObjectId | undefined;
    if (couponCode) {
      const applied = await this.couponsService.applyCoupon(couponCode, restaurantId);
      if (applied.success && applied.coupon) {
        const coupon = applied.coupon as any;
        const usageLimit = Number(coupon.usageLimit ?? 0);
        // Only usage-limited coupons need an atomic claim; unlimited ones apply
        // freely. `claimed` stays true for the unlimited case.
        const claimed =
          usageLimit > 0 ? await this.couponsService.claimUse(coupon._id, usageLimit) : true;
        if (claimed) {
          if (usageLimit > 0) claimedCouponId = coupon._id;
          const remainingAfterOffer = this.maxZeroMoney(subtotalMoney.subtract(offerDiscountMoney));
          couponDiscountMoney = this.minMoney(
            Money.fromDecimal(coupon.discount ?? 0, moneyConfig),
            remainingAfterOffer,
          );
          appliedCouponCode = couponCode;
        }
        // If the limit was already reached (claimed === false) the coupon simply
        // does not apply — the order still goes through at full price.
      }
    }

    const discountAmountMoney = offerDiscountMoney.add(couponDiscountMoney);
    const discountAmount = discountAmountMoney.toNumber();
    const foodTotalMoney = this.maxZeroMoney(subtotalMoney.subtract(discountAmountMoney));
    const foodTotal = foodTotalMoney.toNumber();
    const minOrder = (restaurant as any).minimumOrder;
    if (minOrder && foodTotalMoney.compare(Money.fromDecimal(minOrder, moneyConfig)) < 0)
      throw new BadRequestException(`Minimum order amount is ${minOrder}`);

    const loyaltyEnabled = (config as any)?.loyaltyEnabled ?? true;
    const redemptionRate: number = (config as any)?.loyaltyPointsRedemptionRate ?? 100;
    let loyaltyDiscount = 0;
    let loyaltyPointsUsed = 0;
    if (loyaltyEnabled && loyaltyPointsToRedeem > 0) {
      loyaltyDiscount = await this.loyaltyService.redeemPoints(
        userId,
        loyaltyPointsToRedeem,
        redemptionRate,
        moneyConfig,
      );
      loyaltyPointsUsed = loyaltyPointsToRedeem;
    }

    // Express surcharge (configurable, e.g. 2 DT)
    const expressEnabled = (config as any)?.expressEnabled ?? true;
    const configuredSurcharge: number = (config as any)?.expressSurcharge ?? 0;
    const appliedExpressSurcharge = isExpress && expressEnabled ? configuredSurcharge : 0;

    // Customer service fee — a percentage of the discounted food (`foodTotalMoney`,
    // i.e. A = S − P), floored/capped. Not charged on delivery/tip/tax/express.
    const serviceFeeMoney = this.computeServiceFeeMoney(config, foodTotalMoney, moneyConfig);

    const loyaltyDiscountMoney = Money.fromDecimal(loyaltyDiscount, moneyConfig);
    const deliveryChargesMoney = Money.fromDecimal(authoritativeDeliveryCharges, moneyConfig);
    const tippingMoney = Money.fromDecimal(tipping, moneyConfig);
    const taxationAmountMoney = authoritativeTaxMoney;
    const expressSurchargeMoney = Money.fromDecimal(appliedExpressSurcharge, moneyConfig);
    const orderAmountMoney = this.maxZeroMoney(
      foodTotalMoney.subtract(loyaltyDiscountMoney),
    )
      .add(deliveryChargesMoney)
      .add(tippingMoney)
      .add(taxationAmountMoney)
      .add(expressSurchargeMoney)
      .add(serviceFeeMoney);
    const orderAmount = orderAmountMoney.toNumber();

    const counter = await this.restaurantsService.incrementOrderCounter(restaurantId);
    const orderId = `${(restaurant as any).orderPrefix ?? ''}${String(counter).padStart(3, '0')}`;

    if (!isPickedUp && (restaurant as any).deliveryBounds && coordinates) {
      await this.assertAddressInDeliveryZone(restaurantId, coordinates);
    }

    const deliveryAddress = {
      _id: new Types.ObjectId(),
      location: coordinates ? { type: 'Point', coordinates } : undefined,
      deliveryAddress: address.deliveryAddress,
      details: address.details,
      label: address.label,
    };

    const zoneId = await this.resolveOrderZoneId(restaurant);

    // Compute the order's expected fulfillment time without ever slowing
    // placement with an outbound routing call. Scheduled orders need no estimate
    // (their expected time IS the requested time). ASAP orders reuse the travel
    // estimate the checkout screen already warmed in cache (useProvider: false),
    // falling back to the restaurant's static prep time instantly on a miss.
    const now = new Date();
    const requestedDate = new Date(orderDate);
    const isScheduled = isScheduledOrder;

    let expectedTime: string;
    if (isScheduled) {
      expectedTime = requestedDate.toISOString();
    } else {
      let totalMinutes = this.normalizeNonNegativeInteger((restaurant as any).deliveryTime);
      if (coordinates) {
        try {
          const estimate = await this.deliveryEstimationService.estimate(
            { restaurantId, latitude: coordinates[1], longitude: coordinates[0], isPickedUp },
            { useProvider: false },
          );
          totalMinutes = estimate.totalMinutes;
        } catch (error: any) {
          this.logger.warn(`Delivery estimation failed; using static ETA: ${error?.message ?? 'unknown error'}`);
        }
      }
      expectedTime = new Date(now.getTime() + totalMinutes * 60_000).toISOString();
    }

    const doc = await this.orderModel.create({
      orderId,
      placementIdempotencyKey: idempotencyKey,
      restaurant: new Types.ObjectId(restaurantId),
      user: userMongoId,
      zone: zoneId ? new Types.ObjectId(zoneId) : undefined,
      items,
      deliveryAddress,
      paymentMethod,
      tipping,
      tippingMinor: tippingMoney.toSafeMinorNumber(),
      taxationAmount: taxationAmountMoney.toNumber(),
      taxationAmountMinor: taxationAmountMoney.toSafeMinorNumber(),
      orderAmount,
      orderAmountMinor: orderAmountMoney.toSafeMinorNumber(),
      orderAmountCurrency: orderAmountMoney.currency,
      orderAmountScale: orderAmountMoney.scale,
      discountAmount,
      discountAmountMinor: discountAmountMoney.toSafeMinorNumber(),
      couponCode: appliedCouponCode,
      coupon: claimedCouponId,
      offer: activeOffer ? (activeOffer as any)._id : undefined,
      subtotal,
      subtotalMinor: subtotalMoney.toSafeMinorNumber(),
      deliveryCharges: authoritativeDeliveryCharges,
      deliveryChargesMinor: deliveryChargesMoney.toSafeMinorNumber(),
      deliveryBonus: deliveryBonusAmount,
      deliveryBonusMinor: Money.fromDecimal(deliveryBonusAmount, moneyConfig).toSafeMinorNumber(),
      orderDate,
      expectedTime,
      isPickedUp,
      instructions,
      loyaltyPointsUsed,
      loyaltyDiscount,
      loyaltyDiscountMinor: loyaltyDiscountMoney.toSafeMinorNumber(),
      isExpress: isExpress && expressEnabled,
      expressSurcharge: appliedExpressSurcharge,
      expressSurchargeMinor: expressSurchargeMoney.toSafeMinorNumber(),
      serviceFee: serviceFeeMoney.toNumber(),
      serviceFeeMinor: serviceFeeMoney.toSafeMinorNumber(),
      orderStatus: isScheduled ? 'SCHEDULED' : 'PENDING',
      scheduledFor: isScheduled ? requestedDate.toISOString() : undefined,
      status: 'pending',
      paymentStatus: 'UNPAID',
      paidAmount: 0,
    });

    // Settle wallet payments immediately; on insufficient funds, roll the order back.
    if (paymentMethod === 'WALLET') {
      let debited = false;
      try {
        await this.customerWalletService.debit(userId, orderAmount, {
          order: doc._id,
          reason: `Order ${orderId}`,
        });
        debited = true;
        // Marking PAID must be atomic with the debit above: if this update
        // fails or the process dies here, the customer's wallet has already
        // been charged but the order would be left UNPAID and still enter
        // the pipeline (WALLET isn't in ONLINE_PAYMENT_METHODS, so nothing
        // downstream re-checks payment status). Treat a failure here the
        // same as a failed debit — reverse the charge and roll the order back.
        await this.orderModel
          .updateOne(
            { _id: doc._id },
            {
              $set: {
                paymentStatus: 'PAID',
                paidAmount: orderAmount,
                paidAmountMinor: orderAmountMoney.toSafeMinorNumber(),
                paidAt: new Date().toISOString(),
                paymentProvider: 'WALLET',
              },
            },
          )
          .exec();
      } catch (error) {
        if (debited) {
          await this.customerWalletService
            .credit(userId, orderAmount, { order: doc._id, reason: `Reversal for ${orderId}` })
            .catch((reversalError) =>
              this.logger.error(
                `CRITICAL: failed to reverse wallet debit for ${orderId} after PAID update failed: ${reversalError}`,
              ),
            );
        }
        await this.orderModel.deleteOne({ _id: doc._id }).exec();
        // Give back the coupon redemption we claimed for an order that never was.
        if (claimedCouponId) await this.couponsService.releaseUse(claimedCouponId).catch(() => {});
        throw error;
      }
      // Best-effort audit only: the wallet is already debited and the order is
      // marked PAID, so a failed audit write must not roll the settled order
      // into an error or block the ORDER_PLACED pipeline.
      try {
        await this.paymentAttempts?.recordSucceeded({
          subjectType: 'ORDER',
          subjectId: String(doc._id),
          amountMinor: orderAmountMoney.toSafeMinorNumber(),
          amountCurrency: orderAmountMoney.currency,
          amountScale: orderAmountMoney.scale,
          provider: 'WALLET',
          providerReference: `wallet:${String(doc._id)}`,
          idempotencyKey: String(doc._id),
          raw: {
            paymentMethod: 'WALLET',
            orderId,
            walletUserId: userId,
          },
        });
      } catch (error) {
        this.logger.warn(
          `Failed to record wallet payment attempt for ${orderId}: ${error}`,
        );
      }
    }

    const placedOrder = await this.findOrderOrThrow(String(doc._id));

    // Online (Flouci) orders are held until payment succeeds — the restaurant is
    // only notified from markOrderPaid(). COD and already-settled WALLET orders
    // enter the pipeline immediately.
    // No `zoneId` here: a zoneId on ORDER_PLACED is the rider zone-broadcast
    // marker (subscriptionZoneOrders filters on it). Riders must only hear
    // about an order once the store marks it PREPARED — a PENDING order is a
    // store/admin event only.
    if (!ONLINE_PAYMENT_METHODS.includes(paymentMethod)) {
      await this.pubSub.publish(Events.ORDER_PLACED, {
        [Events.ORDER_PLACED]: { userId, origin: 'new', restaurantId, order: placedOrder },
      });
      this.notifyAdminNewOrder(placedOrder).catch(() => {});
      this.notifyStoreNewOrder(placedOrder).catch(() => {});
    }
    return placedOrder;
  }

  /**
   * Marks an online-payment order as paid and releases it into the fulfillment
   * pipeline (the restaurant is only notified once payment succeeds). Idempotent.
   */
  async markOrderPaid(
    orderId: string,
    payload: { paidAmount?: number; paidAmountMinor?: number; reference?: string; provider?: string },
  ): Promise<OrderDocument> {
    const order = await this.orderModel.findById(orderId).exec();
    if (!order) throw new NotFoundException('Order not found');
    if ((order as any).paymentStatus === 'PAID') return this.findOrderOrThrow(orderId);

    (order as any).paymentStatus = 'PAID';
    (order as any).paidAmount = payload.paidAmount ?? (order as any).orderAmount ?? 0;
    (order as any).paidAmountMinor =
      payload.paidAmountMinor ??
      (order as any).orderAmountMinor ??
      Money.fromDecimal((order as any).paidAmount, {
        currency: (order as any).orderAmountCurrency,
        scale: (order as any).orderAmountScale,
      }).toSafeMinorNumber();
    (order as any).paidAt = new Date().toISOString();
    if (payload.reference) (order as any).paymentReference = payload.reference;
    if (payload.provider) (order as any).paymentProvider = payload.provider;
    await order.save();

    const placedOrder = await this.findOrderOrThrow(orderId);
    const populated: any = placedOrder;
    // No `zoneId`: paid orders enter the pipeline at PENDING — riders are only
    // brought in when the store marks the order PREPARED.
    await this.pubSub.publish(Events.ORDER_PLACED, {
      [Events.ORDER_PLACED]: {
        userId: populated.user?.clerkId,
        origin: 'new',
        restaurantId: populated.restaurant?._id?.toString(),
        order: placedOrder,
      },
    });
    this.notifyAdminNewOrder(placedOrder).catch(() => {});
    this.notifyStoreNewOrder(placedOrder).catch(() => {});
    return placedOrder;
  }

  /**
   * Persists an admin bell notification for a newly-placed order. Best-effort:
   * failures here must never affect order placement.
   */
  private async notifyAdminNewOrder(order: OrderDocument): Promise<void> {
    const restaurantName = (order as any).restaurant?.name ?? 'A restaurant';
    await this.notificationsService.createWebNotification(
      `New order placed at ${restaurantName}`,
      '/management/orders',
    );
  }

  /**
   * Push-notifies the store (per-restaurant login and owning vendor account)
   * that a new order arrived. Best-effort: the in-app GraphQL subscription is
   * the primary channel; this covers a backgrounded store app.
   */
  private async notifyStoreNewOrder(order: OrderDocument): Promise<void> {
    const restaurantId =
      (order as any).restaurant?._id?.toString() ?? (order as any).restaurant?.toString();
    if (!restaurantId) return;
    const identities = await this.restaurantsService.getPushIdentities(restaurantId);
    if (!identities.length) return;
    const orderId = String((order as any)._id);
    await this.notificationsService.broadcastPush(
      identities,
      'Nouvelle commande 🛎️',
      `Commande #${(order as any).orderId ?? orderId} reçue — appuyez pour la traiter`,
      { type: 'NEW_ORDER', orderId },
    );
  }

  /**
   * Refunds a paid order to the customer's wallet and marks it REFUNDED — the
   * natural refund path for an online (Flouci) or wallet order.
   */
  async refundOrderToWallet(orderId: string, reason?: string): Promise<OrderDocument> {
    const order = await this.orderModel.findById(orderId).exec();
    if (!order) throw new NotFoundException('Order not found');
    if ((order as any).paymentStatus !== 'PAID')
      throw new BadRequestException('Only paid orders can be refunded');

    const userClerkId = await this.resolveUserClerkId((order as any).user);
    const amount = (order as any).paidAmount ?? (order as any).orderAmount ?? 0;
    await this.customerWalletService.credit(userClerkId, amount, {
      order: (order as any)._id,
      type: 'REFUND',
      reason: reason ?? `Refund for order ${(order as any).orderId}`,
    });

    (order as any).paymentStatus = 'REFUNDED';
    await order.save();
    await this.publishOrderStatusChanged(orderId);
    return this.findOrderOrThrow(orderId);
  }

  private async resolveUserClerkId(userObjectId: Types.ObjectId): Promise<string> {
    return this.usersService.resolveClerkIdByMongoId(userObjectId);
  }

  /**
   * Order gate — delegates to the shared `evaluateOpen` evaluator so the gate
   * and the `isOpen` GraphQL field can never disagree. `when` is the moment to
   * judge against (now for ASAP, the scheduled slot for future orders). The
   * restaurant's own IANA timezone is used, falling back to the configured
   * default — never the host clock.
   */
  private assertRestaurantOpenAt(restaurant: any, when: Date): void {
    const defaultTimezone =
      this.config.get<string>('DEFAULT_RESTAURANT_TIMEZONE') ?? DEFAULT_TIMEZONE_FALLBACK;
    const status = evaluateOpen({
      openingTimes: restaurant.openingTimes,
      isAvailable: restaurant.isAvailable,
      timezone: restaurant.timezone ?? defaultTimezone,
      now: when,
    });
    if (status.isOpen) return;
    switch (status.reason) {
      case 'unavailable':
        throw new BadRequestException('Restaurant is not accepting orders right now');
      case 'closed-today':
        throw new BadRequestException('Restaurant is closed today');
      default:
        throw new BadRequestException('Restaurant is currently closed');
    }
  }

  private async assertAddressInDeliveryZone(
    restaurantId: string,
    coordinates: number[],
  ): Promise<void> {
    const inZone = await this.restaurantsService.isAddressInDeliveryBounds(
      restaurantId,
      coordinates,
    );
    if (!inZone)
      throw new BadRequestException(
        "Delivery address is outside the restaurant's delivery zone",
      );
  }

  private resolveDeliveryCoordinates(address: PlaceOrderAddressInput): number[] | undefined {
    if (address.location?.coordinates) {
      const coordinates = address.location.coordinates.map(Number);
      if (coordinates.length === 2 && coordinates.every(Number.isFinite)) {
        return coordinates;
      }
      throw new BadRequestException('Invalid address coordinates');
    }

    if (address.longitude !== undefined || address.latitude !== undefined) {
      const longitude = Number(address.longitude);
      const latitude = Number(address.latitude);
      if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
        return [longitude, latitude];
      }
      throw new BadRequestException('Invalid address coordinates');
    }

    return undefined;
  }

  /**
   * Server-authoritative delivery fee. Never trusts the client-supplied amount:
   * pickup orders pay nothing; delivered orders are priced from the config model
   * and the straight-line distance between the restaurant and the delivery point.
   * A missing distance falls back to the flat `deliveryRate` (the client's own
   * fallback), so a legitimate order without coordinates still gets a sane fee —
   * but the payload can never force the fee to 0 or a negative value.
   */
  /**
   * Straight-line restaurant→address distance (km) used for delivery pricing.
   * Returns null when the order is pickup or coordinates are missing/invalid,
   * so callers can apply their own fallback.
   */
  private resolveDeliveryDistanceKm(
    restaurant: unknown,
    coordinates: number[] | undefined,
    isPickedUp: boolean,
  ): number | null {
    if (isPickedUp) return null;
    const origin = (restaurant as any)?.location?.coordinates;
    const originLon = Number(origin?.[0]);
    const originLat = Number(origin?.[1]);
    if (coordinates && Number.isFinite(originLon) && Number.isFinite(originLat)) {
      return haversineKm(originLat, originLon, coordinates[1], coordinates[0]);
    }
    return null;
  }

  private resolveAuthoritativeDeliveryCharges(
    restaurant: unknown,
    config: DeliveryFeeConfig | null | undefined,
    coordinates: number[] | undefined,
    isPickedUp: boolean,
  ): number {
    if (isPickedUp) return 0;

    const distanceKm = this.resolveDeliveryDistanceKm(restaurant, coordinates, isPickedUp);
    if (distanceKm !== null) {
      const fee = computeDeliveryFee(config, distanceKm);
      if (fee > 0) return fee;
    }

    // Coordinates missing/invalid: fall back to the flat `deliveryRate`, but run it
    // through the same normalization (round-to-nearest + floor/cap) so an
    // address-quality difference can never bypass the configured caps/rounding.
    const flatRate = Number(config?.deliveryRate);
    return Number.isFinite(flatRate) && flatRate > 0 ? normalizeFee(flatRate, config) : 0;
  }

  private async resolveOrderZoneId(restaurant: any): Promise<string | undefined> {
    const restaurantCoordinates = restaurant?.location?.coordinates;
    const fallbackCoordinates =
      Array.isArray(restaurantCoordinates) && restaurantCoordinates.length === 2
        ? restaurantCoordinates.map(Number)
        : undefined;

    if (!fallbackCoordinates?.every(Number.isFinite)) return undefined;

    const zone = await this.zonesService.findByPoint(fallbackCoordinates[0], fallbackCoordinates[1]);
    return zone?._id?.toString();
  }

  private normalizeNonNegativeInteger(value: unknown): number {
    const minutes = Number(value);
    return Number.isFinite(minutes) && minutes >= 0 ? Math.floor(minutes) : 0;
  }

  private zeroMoney(currencyConfig: { currency?: string; scale?: number }): Money {
    return Money.fromDecimal(0, currencyConfig);
  }

  private minMoney(a: Money, b: Money): Money {
    return a.compare(b) <= 0 ? a : b;
  }

  private maxMoney(a: Money, b: Money): Money {
    return a.compare(b) >= 0 ? a : b;
  }

  /**
   * Server-authoritative customer service fee: a percentage of the discounted
   * food amount, clamped to a floor and (optional) cap. Mirrors the customer
   * app's `calculateServiceFee`. Disabled or a zero rate yields 0. The floor is
   * applied first so it is honoured even when no cap is set; the cap only clamps
   * when it is a positive value (0 = uncapped).
   */
  private computeServiceFeeMoney(
    config: any,
    foodTotalMoney: Money,
    currencyConfig: { currency?: string; scale?: number },
  ): Money {
    if (!config?.serviceFeeEnabled) return this.zeroMoney(currencyConfig);
    const rate = Number(config?.serviceFeeRate);
    if (!Number.isFinite(rate) || rate <= 0) return this.zeroMoney(currencyConfig);

    const raw = foodTotalMoney.multiply(String(rate));
    const floor = Money.fromDecimal(Number(config?.serviceFeeMinimum) || 0, currencyConfig);
    let fee = this.maxMoney(raw, floor);

    const capValue = Number(config?.serviceFeeMaximum);
    if (Number.isFinite(capValue) && capValue > 0) {
      fee = this.minMoney(fee, Money.fromDecimal(capValue, currencyConfig));
    }
    return fee;
  }

  private maxZeroMoney(value: Money): Money {
    const zero = Money.ofMinor(0n, { currency: value.currency, scale: value.scale });
    return value.compare(zero) >= 0 ? value : zero;
  }

  private orderItemsTotalMoney(
    items: any[],
    currencyConfig: { currency?: string; scale?: number },
  ): Money {
    return items.reduce(
      (sum, item) => sum.add(this.orderItemLineTotalMoney(item, currencyConfig)),
      this.zeroMoney(currencyConfig),
    );
  }

  private orderItemLineTotalMoney(
    item: any,
    currencyConfig: { currency?: string; scale?: number },
  ): Money {
    const addonTotal = (item.addons ?? []).reduce(
      (sum: Money, addon: any) =>
        (addon.options ?? []).reduce(
          (optionSum: Money, option: any) =>
            optionSum.add(Money.fromDecimal(option.price ?? 0, currencyConfig)),
          sum,
        ),
      this.zeroMoney(currencyConfig),
    );

    return Money.fromDecimal(item.variation?.price ?? 0, currencyConfig)
      .add(addonTotal)
      .multiply(String(item.quantity ?? 1));
  }

  private buildOrderItem(
    input: OrderItemInput,
    catalog: { foods: any[]; addons: any[]; options: any[] },
  ) {
    // The money math trusts nothing from the request: quantity must be a whole
    // positive number (a 0 line is a phantom, a negative one would *credit* the
    // customer), and the item/variation must still exist in the live catalog —
    // otherwise a deleted item would be priced at 0 and shipped for free. This
    // guards both placeOrder and reOrder (which rebuilds items from a stored,
    // un-validated snapshot).
    const quantity = Number(input.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new BadRequestException('Invalid item quantity');
    }

    const food = this.findFood(String(input.food), catalog.foods);
    if (!food) throw new BadRequestException('One or more items are no longer available');
    const variation = food?.variations?.find((v: any) => String(v._id) === String(input.variation));
    if (food.variations?.length && !variation) {
      throw new BadRequestException('A selected item option is no longer available');
    }
    const addons = (input.addons ?? []).map((addonInput) => {
      const addon = (catalog.addons ?? []).find(
        (a: any) => String(a._id) === String(addonInput._id),
      );
      const options = (addonInput.options ?? [])
        .map((optId) =>
          (catalog.options ?? []).find((o: any) => String(o._id) === String(optId)),
        )
        .filter(Boolean)
        .map((o: any) => ({
          _id: new Types.ObjectId(),
          title: o.title,
          description: o.description,
          price: o.price,
        }));
      return {
        _id: new Types.ObjectId(),
        options,
        title: addon?.title,
        description: addon?.description,
        quantityMinimum: addon?.quantityMinimum,
        quantityMaximum: addon?.quantityMaximum,
      };
    });

    return {
      _id: new Types.ObjectId(),
      title: food?.title,
      food: String(input.food),
      description: food?.description,
      image: food?.image,
      quantity,
      variation: variation
        ? {
            _id: new Types.ObjectId(),
            title: variation.title,
            price: variation.price,
            discounted: variation.discounted,
          }
        : undefined,
      addons,
      specialInstructions: input.specialInstructions,
      isActive: true,
    };
  }

  private findFood(foodId: string, foods: any[]) {
    return (foods ?? []).find((f: any) => String(f._id) === foodId) ?? null;
  }

  // ── customer queries ──────────────────────────────────────────────────────

  async getOrdersByUser(userId: string, offset = 0, limit = 20): Promise<OrderDocument[]> {
    const userMongoId = await this.resolveUserMongoId(userId);
    return this.withPopulate(
      this.orderModel.find({ user: userMongoId }).sort({ createdAt: -1 }).skip(offset).limit(limit),
    )
      .lean()
      .exec() as Promise<OrderDocument[]>;
  }

  private static readonly PAST_STATUSES = ['DELIVERED', 'CANCELLED'];
  private static readonly ACTIVE_STATUSES = [
    'PENDING',
    'ACCEPTED',
    'PREPARED',
    'AWAITING_RIDER',
    'ASSIGNED',
    'PICKED',
    'ARRIVED',
  ];

  async getUsersPastOrders(
    userId: string,
    page = 1,
    limit = 10,
    offset = 0,
  ): Promise<OrderDocument[]> {
    const skip = offset > 0 ? offset : (page - 1) * limit;
    const userMongoId = await this.resolveUserMongoId(userId);
    return this.withPopulate(
      this.orderModel
        .find({ user: userMongoId, orderStatus: { $in: OrdersService.PAST_STATUSES } })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
    )
      .lean()
      .exec() as Promise<OrderDocument[]>;
  }

  async getUsersActiveOrders(
    userId: string,
    page = 1,
    limit = 10,
    offset = 0,
  ): Promise<OrderDocument[]> {
    const skip = offset > 0 ? offset : (page - 1) * limit;
    const userMongoId = await this.resolveUserMongoId(userId);
    const activeQuery = {
      user: userMongoId,
      $or: [
        { orderStatus: { $in: OrdersService.ACTIVE_STATUSES } },
        { orderStatus: { $exists: false }, status: 'pending' },
        { orderStatus: null, status: 'pending' },
      ],
    };
    return this.withPopulate(
      this.orderModel
        .find(activeQuery)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
    )
      .lean()
      .exec() as Promise<OrderDocument[]>;
  }

  findById(id: string): Promise<OrderDocument> {
    return this.findOrderOrThrow(id);
  }

  async findByIdForUser(id: string, userId: string): Promise<OrderDocument> {
    const [order, userMongoId] = await Promise.all([
      this.findOrderOrThrow(id),
      this.resolveUserMongoId(userId),
    ]);
    const ownerId = String((order as any).user?._id ?? (order as any).user);
    if (ownerId !== String(userMongoId)) throw new ForbiddenException('Not your order');
    return order;
  }

  // ── abortOrder ────────────────────────────────────────────────────────────

  async abortOrder(userId: string, orderId: string): Promise<OrderDocument> {
    const [order, userMongoId] = await Promise.all([
      this.orderModel.findById(orderId).lean().exec(),
      this.resolveUserMongoId(userId),
    ]);
    if (!order) throw new NotFoundException('Order not found');
    if (String((order as any).user) !== String(userMongoId))
      throw new ForbiddenException('Not your order');
    const cancellableStatuses = ['PENDING', 'ACCEPTED'];
    if (!cancellableStatuses.includes((order as any).orderStatus))
      throw new BadRequestException('Order can only be cancelled before it is being prepared');

    await this.orderModel
      .findByIdAndUpdate(
        orderId,
        { $set: { orderStatus: 'CANCELLED', cancelledAt: new Date().toISOString() } },
        { new: true },
      )
      .lean()
      .exec();

    // Refund loyalty points if customer had redeemed any on this order
    const loyaltyPointsUsed: number = (order as any).loyaltyPointsUsed ?? 0;
    if (loyaltyPointsUsed > 0) {
      this.loyaltyService.refundPoints(userId, loyaltyPointsUsed).catch(() => {});
    }

    // Release a claimed usage-limited coupon so the customer can use it again.
    if ((order as any).coupon) {
      this.couponsService.releaseUse((order as any).coupon).catch(() => {});
    }

    // Refund to wallet any order that was actually captured — WALLET debits
    // settle at placement, and online (FLOUCI) payments settle via
    // markOrderPaid(); COD never reaches paymentStatus PAID before delivery,
    // so this can't accidentally "refund" an uncollected cash order.
    if ((order as any).paymentStatus === 'PAID') {
      const refundAmount: number = (order as any).paidAmount ?? (order as any).orderAmount ?? 0;
      if (refundAmount > 0) {
        await this.customerWalletService.credit(userId, refundAmount, {
          order: orderId,
          reason: 'REFUND_CUSTOMER_CANCELLED',
        });
        await this.orderModel
          .findByIdAndUpdate(orderId, { $set: { paymentStatus: 'REFUNDED' } })
          .lean()
          .exec();
      }
    }

    const populated = await this.findOrderOrThrow(orderId);
    await this.publishOrderStatusChanged(orderId);
    // Riders are dispatched from ACCEPTED (Sfax field flow), so zone riders may
    // already be ringing/listing this order — broadcast its removal so their
    // lists and incoming-order modals drop it immediately.
    await this.publishZoneOrderRemoved(populated);
    await this.trackingService.terminateOrderTracking(orderId);
    return populated;
  }

  // ── updateDeliveryAddress ────────────────────────────────────────────────
  // Lets a customer correct/redirect a delivery address before the restaurant
  // has started preparing it. Once PREPARED (or later), the rider may already
  // be en route or have the address printed on a receipt, so a silent address
  // swap at that point is a dispatch/safety risk, not a convenience — the
  // customer must contact support instead.
  private static readonly ADDRESS_EDITABLE_STATUSES = ['PENDING', 'ACCEPTED'];

  async updateDeliveryAddress(
    userId: string,
    orderId: string,
    address: { label?: string; deliveryAddress?: string; details?: string; coordinates?: number[] },
  ): Promise<OrderDocument> {
    const [order, userMongoId] = await Promise.all([
      this.orderModel.findById(orderId).lean().exec(),
      this.resolveUserMongoId(userId),
    ]);
    if (!order) throw new NotFoundException('Order not found');
    if (String((order as any).user) !== String(userMongoId))
      throw new ForbiddenException('Not your order');
    if (!OrdersService.ADDRESS_EDITABLE_STATUSES.includes((order as any).orderStatus))
      throw new BadRequestException(
        'Delivery address can only be changed before the restaurant starts preparing the order',
      );

    await this.orderModel
      .findByIdAndUpdate(orderId, {
        $set: {
          'deliveryAddress.label': address.label,
          'deliveryAddress.deliveryAddress': address.deliveryAddress,
          'deliveryAddress.details': address.details,
          ...(address.coordinates
            ? { 'deliveryAddress.location': { type: 'Point', coordinates: address.coordinates } }
            : {}),
        },
      })
      .exec();

    const populated = await this.findOrderOrThrow(orderId);
    // Restaurant/rider views subscribe to order-status-changed for any order
    // detail refresh, not just literal status transitions, so this is the
    // correct signal to make the new address show up live.
    await this.publishOrderStatusChanged(orderId);
    return populated;
  }

  // Tells zone riders an unclaimed order is gone (claimed elsewhere/cancelled).
  private async publishZoneOrderRemoved(order: OrderDocument): Promise<void> {
    const zoneId = (order as any).zone?._id?.toString() ?? (order as any).zone?.toString();
    if (!zoneId) return;
    const restaurantId = String((order as any).restaurant?._id ?? (order as any).restaurant);
    await this.pubSub.publish(Events.ORDER_PLACED, {
      [Events.ORDER_PLACED]: { origin: 'remove', restaurantId, zoneId, order },
    });
  }

  // ── reOrder ───────────────────────────────────────────────────────────────

  async reOrder(
    userId: string,
    orderId: string,
    address: PlaceOrderAddressInput,
    deliveryCharges: number,
    tipping: number,
    isPickedUp: boolean,
    paymentMethod: string,
  ): Promise<OrderDocument> {
    const [order, userMongoId] = await Promise.all([
      this.orderModel.findById(orderId).lean().exec(),
      this.resolveUserMongoId(userId),
    ]);
    if (!order) throw new NotFoundException('Order not found');
    if (String((order as any).user) !== String(userMongoId))
      throw new ForbiddenException('Not your order');

    // Reconstruct OrderItemInput[] from stored order items
    const orderInput: OrderItemInput[] = ((order as any).items ?? []).map((item: any) => ({
      food: String(item.food?._id ?? item.food),
      quantity: item.quantity ?? 1,
      variation: String(item.variation?._id ?? item.variation),
      addons: (item.addons ?? []).map((addon: any) => ({
        _id: String(addon._id),
        options: (addon.options ?? []).map((opt: any) => String(opt._id ?? opt)),
      })),
      specialInstructions: item.specialInstructions,
    }));

    // Re-use the original taxationAmount so the customer sees the same tax
    // breakdown from their last order (tax rate is unlikely to change).
    const taxationAmount = (order as any).taxationAmount ?? 0;

    return this.placeOrder(
      userId,
      String((order as any).restaurant?._id ?? (order as any).restaurant),
      orderInput,
      paymentMethod,
      tipping,
      taxationAmount,
      address,
      new Date().toISOString(),
      isPickedUp,
      deliveryCharges,
      (order as any).instructions,
    );
  }

  // ── reviewOrder ───────────────────────────────────────────────────────────

  async reviewOrder(userId: string, input: ReviewInput): Promise<OrderDocument> {
    const [order, userMongoId] = await Promise.all([
      this.orderModel.findById(input.order).lean().exec(),
      this.resolveUserMongoId(userId),
    ]);
    if (!order) throw new NotFoundException('Order not found');
    if (String((order as any).user) !== String(userMongoId))
      throw new ForbiddenException('Not your order');
    if ((order as any).review) throw new BadRequestException('Order already reviewed');

    const review = await this.reviewModel.create({
      order: new Types.ObjectId(input.order),
      restaurant: (order as any).restaurant,
      user: userMongoId,
      rating: input.rating,
      description: input.description,
      isActive: true,
    });

    const updated = await this.orderModel
      .findByIdAndUpdate(input.order, { $set: { review: review._id } }, { new: true })
      .lean()
      .exec();

    return this.findOrderOrThrow(String(updated!._id));
  }

  // ── store queries/mutations ───────────────────────────────────────────────

  async getRestaurantOrders(restaurantId: string): Promise<OrderDocument[]> {
    return this.withPopulate(
      this.orderModel
        .find({ restaurant: new Types.ObjectId(restaurantId) })
        .sort({ createdAt: -1 }),
    )
      .lean()
      .exec() as Promise<OrderDocument[]>;
  }

  async acceptOrder(id: string, restaurantId: string, time?: string): Promise<OrderDocument> {
    const order = await this.findOrderOrThrow(id);
    const orderRestaurant = String((order as any).restaurant?._id ?? (order as any).restaurant);
    if (orderRestaurant !== restaurantId)
      throw new ForbiddenException('Order does not belong to your restaurant');

    const now = new Date();
    // `time` is the prep duration in minutes chosen by the store (e.g. "20").
    // Persist preparationTime as the absolute completion timestamp (now + minutes)
    // so clients can render a countdown via `new Date(preparationTime)`.
    const minutes = Number.parseInt(time ?? '', 10);
    const preparationTime = new Date(
      now.getTime() + (Number.isFinite(minutes) ? minutes : 0) * 60 * 1000,
    ).toISOString();
    // Only a PENDING order can be accepted. The conditional filter also makes this
    // idempotent and prevents moving a closed/in-progress order back to ACCEPTED.
    const raw = await this.orderModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), orderStatus: 'PENDING' },
        {
          $set: {
            orderStatus: 'ACCEPTED',
            preparationTime,
            acceptedAt: now.toISOString(),
            isRinged: true,
          },
        },
        { new: true },
      )
      .lean()
      .exec();
    if (!raw) {
      if ((order as any).orderStatus === 'ACCEPTED') return this.findOrderOrThrow(id);
      throw new BadRequestException(
        `Order cannot be accepted while it is ${(order as any).orderStatus}`,
      );
    }
    await this.publishOrderStatusChanged(id);

    // Push to customer: order accepted + ETA
    const accepted = await this.findOrderOrThrow(id);

    // Field flow (Sfax): riders are engaged as soon as the store accepts, not
    // only at PREPARED — broadcast to the zone and ping nearby riders now so a
    // rider can already ride toward the restaurant while the food is prepared.
    // Same populated-`zone` caveat as markOrderPrepared — read `._id` first.
    const acceptedZoneId =
      (accepted as any).zone?._id?.toString() ?? (accepted as any).zone?.toString();
    if (acceptedZoneId) {
      await this.pubSub.publish(Events.ORDER_PLACED, {
        [Events.ORDER_PLACED]: {
          origin: 'new',
          restaurantId,
          zoneId: acceptedZoneId,
          order: accepted,
        },
      });
    }
    const acceptBroadcastRadius = (accepted as any).isExpress ? 15 : NEARBY_RIDER_RADIUS_KM;
    this.dispatchNearbyRiders(accepted, acceptBroadcastRadius, 'accepted').catch(() => {});

    const customerClerkId = (accepted as any).user?.clerkId;
    if (customerClerkId) {
      const etaLabel = time ? ` — ready in ~${time} min` : '';
      this.notificationsService
        .sendPushToUser(
          customerClerkId,
          'CUSTOMER',
          'Order accepted ✅',
          `Your order is being prepared${etaLabel}`,
          { type: 'ORDER_ACCEPTED', orderId: id },
        )
        .catch(() => {});
    }

    return accepted;
  }

  private moneyCurrencyConfig(config: any): { currency?: string; scale?: number } {
    return {
      currency: config?.currency,
      scale: config?.currencyDecimalDigits,
    };
  }

  private async getRiderCommissionConfig(): Promise<{
    rate: number;
    currency?: string;
    scale?: number;
  }> {
    const config = await this.configurationModel
      .findOne({}, 'riderCommissionRate currency currencyDecimalDigits')
      .lean()
      .exec();
    return {
      ...this.moneyCurrencyConfig(config),
      rate: Math.max(0, Math.min(1, (config as any)?.riderCommissionRate ?? 0)),
    };
  }

  /**
   * Admin override of the platform-funded rider bonus for a single order. The
   * bonus is not part of the customer total; it is credited to the rider at
   * delivery. A negative amount is clamped to 0 (pass 0 to clear the bonus).
   */
  async setDeliveryBonus(id: string, amount: number): Promise<OrderDocument> {
    const moneyConfig = this.moneyCurrencyConfig(
      await this.configurationModel.findOne({}, 'currency currencyDecimalDigits').lean().exec(),
    );
    return this.persistDeliveryBonus(id, Number(amount) || 0, moneyConfig);
  }

  /**
   * Reset an order's rider bonus to the config-driven distance default, undoing
   * any manual override. Recomputes from the restaurant→address distance and the
   * current bonus config — the same formula used at placement — so "reset to
   * default" reflects the live configuration, not a stale stored value. Pickup
   * orders (no delivery) reset to 0.
   */
  async recomputeDeliveryBonus(id: string): Promise<OrderDocument> {
    const order = await this.orderModel
      .findById(id, 'restaurant deliveryAddress isPickedUp')
      .populate('restaurant', 'location')
      .lean()
      .exec();
    if (!order) throw new NotFoundException(`Order ${id} not found`);

    const config = await this.configurationModel
      .findOne(
        {},
        'currency currencyDecimalDigits deliveryBonusEnabled deliveryBonusPerKm deliveryBonusFreeDistance deliveryBonusMax',
      )
      .lean()
      .exec();
    const moneyConfig = this.moneyCurrencyConfig(config);

    const coordinates = (order as any).deliveryAddress?.location?.coordinates;
    const distanceKm = this.resolveDeliveryDistanceKm(
      (order as any).restaurant,
      coordinates,
      (order as any).isPickedUp ?? false,
    );
    const defaultBonus = (order as any).isPickedUp
      ? 0
      : computeDeliveryBonus(config as any, distanceKm ?? 0);

    return this.persistDeliveryBonus(id, defaultBonus, moneyConfig);
  }

  private async persistDeliveryBonus(
    id: string,
    amount: number,
    moneyConfig: { currency?: string; scale?: number },
  ): Promise<OrderDocument> {
    const bonusMoney = this.maxZeroMoney(Money.fromDecimal(amount, moneyConfig));
    const updated = await this.orderModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            deliveryBonus: bonusMoney.toNumber(),
            deliveryBonusMinor: bonusMoney.toSafeMinorNumber(),
          },
        },
        { new: true },
      )
      .exec();
    if (!updated) throw new NotFoundException(`Order ${id} not found`);
    return updated;
  }

  async markOrderPrepared(id: string, restaurantId: string): Promise<OrderDocument> {
    const commissionConfig = await this.getRiderCommissionConfig();
    const orderRaw = await this.orderModel
      .findById(id, 'restaurant deliveryCharges orderStatus zone')
      .lean()
      .exec();
    if (!orderRaw) throw new NotFoundException(`Order ${id} not found`);
    const orderRestaurant = String((orderRaw as any).restaurant);
    if (orderRestaurant !== restaurantId)
      throw new ForbiddenException('Order does not belong to your restaurant');

    const deliveryCharges: number = (orderRaw as any).deliveryCharges ?? 0;
    const riderCommissionMoney = Money.fromDecimal(deliveryCharges, commissionConfig).multiply(
      String(commissionConfig.rate),
    );
    const riderCommission = riderCommissionMoney.toNumber();

    // Only freeze a positive commission. A zero (e.g. rate not yet configured) is
    // left unset so finalizeDeliveryIfBothConfirmed recomputes from the current rate
    // at delivery time instead of permanently suppressing the credit.
    const set: Record<string, unknown> = {
      orderStatus: 'PREPARED',
      preparedAt: new Date().toISOString(),
    };
    if (riderCommission > 0) {
      set.riderCommission = riderCommission;
      set.riderCommissionMinor = riderCommissionMoney.toSafeMinorNumber();
    }

    const raw = await this.orderModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), orderStatus: 'ACCEPTED' },
        { $set: set },
        { new: true },
      )
      .lean()
      .exec();

    if (!raw) {
      // Riders can claim an order right after the store accepts it, so it may
      // already be AWAITING_RIDER/ASSIGNED here. Don't regress the status —
      // just record preparedAt (and freeze the commission) once.
      const { orderStatus: _status, ...prepInfo } = set;
      const marked = await this.orderModel
        .findOneAndUpdate(
          {
            _id: new Types.ObjectId(id),
            orderStatus: { $in: ['AWAITING_RIDER', 'ASSIGNED'] },
            preparedAt: { $exists: false },
          },
          { $set: prepInfo },
          { new: true },
        )
        .lean()
        .exec();
      if (marked) await this.publishOrderStatusChanged(id);
      return this.findOrderOrThrow(id); // already PREPARED/claimed — idempotent
    }

    await this.publishOrderStatusChanged(id);
    const prepared = await this.findOrderOrThrow(id);
    // `zone` comes back populated ({ _id, title }) from findOrderOrThrow, so
    // `.toString()` alone would stringify the object itself ("[object
    // Object]") instead of the id — always read `._id` first.
    const zoneId = (prepared as any).zone?._id?.toString() ?? (prepared as any).zone?.toString();
    if (zoneId) {
      await this.pubSub.publish(Events.ORDER_PLACED, {
        [Events.ORDER_PLACED]: { origin: 'new', restaurantId, zoneId, order: prepared },
      });
    }
    // Express orders get a wider initial rider search radius (15km instead of 8km)
    const broadcastRadius = (prepared as any).isExpress ? 15 : NEARBY_RIDER_RADIUS_KM;
    this.dispatchNearbyRiders(
      prepared,
      broadcastRadius,
      (prepared as any).isExpress ? 'prepared_express' : 'prepared',
    ).catch(() => {});
    return prepared;
  }

  private async dispatchNearbyRiders(
    order: OrderDocument,
    radiusKm: number = NEARBY_RIDER_RADIUS_KM,
    reason: DispatchReason = 'prepared',
  ): Promise<void> {
    const restaurantId =
      (order as any).restaurant?._id?.toString() ?? (order as any).restaurant?.toString();
    const zoneId = (order as any).zone?._id?.toString() ?? (order as any).zone?.toString();
    if (!restaurantId) {
      this.logger.warn(`[dispatch] Order ${(order as any)._id} has no restaurant, skipping`);
      return;
    }
    await this.dispatchService.notifyNearbyRiders({
      orderId: String((order as any)._id),
      restaurantId,
      zoneId,
      radiusKm,
      reason,
    });
  }

  async cancelOrder(id: string, restaurantId: string, reason: string): Promise<OrderDocument> {
    const order = await this.findOrderOrThrow(id);
    const orderRestaurant = String((order as any).restaurant?._id ?? (order as any).restaurant);
    if (orderRestaurant !== restaurantId)
      throw new ForbiddenException('Order does not belong to your restaurant');

    // A store may only cancel before the rider has collected the order. Once it is
    // PICKED/DELIVERED (or already closed) cancelling would strand an in-transit
    // delivery and could leave a rider credited for an undelivered order.
    const CANCELLABLE_FROM = ['PENDING', 'ACCEPTED', 'PREPARED', 'AWAITING_RIDER', 'ASSIGNED'];
    if (!CANCELLABLE_FROM.includes((order as any).orderStatus)) {
      throw new BadRequestException(
        `Order cannot be cancelled once it is ${(order as any).orderStatus}`,
      );
    }

    const statusUpdate: Record<string, unknown> = {
      orderStatus: 'CANCELLED',
      reason,
      cancelledAt: new Date().toISOString(),
    };

    // Refund to wallet any order that was actually captured (WALLET or online
    // FLOUCI); COD never reaches paymentStatus PAID before delivery.
    if ((order as any).paymentStatus === 'PAID') {
      const refundAmount: number = (order as any).paidAmount ?? (order as any).orderAmount ?? 0;
      const customerClerkId: string | undefined = (order as any).user?.clerkId;
      if (refundAmount > 0 && customerClerkId) {
        await this.customerWalletService.credit(customerClerkId, refundAmount, {
          order: id,
          reason: 'REFUND_RESTAURANT_CANCELLED',
        });
        statusUpdate.paymentStatus = 'REFUNDED';
      }
    }

    const raw = await this.orderModel
      .findByIdAndUpdate(id, { $set: statusUpdate }, { new: true })
      .lean()
      .exec();
    if (!raw) throw new NotFoundException('Order not found');

    // Release a claimed usage-limited coupon so the customer isn't charged a
    // redemption for an order the restaurant refused.
    if ((order as any).coupon) {
      this.couponsService.releaseUse((order as any).coupon).catch(() => {});
    }

    await this.publishOrderStatusChanged(id);
    const cancelled = await this.findOrderOrThrow(id);
    // Unclaimed order: zone riders may be ringing/listing it since ACCEPTED —
    // broadcast its removal. Claimed order: tell the assigned rider directly
    // so the course drops off their processing list without a manual refresh.
    await this.publishZoneOrderRemoved(cancelled);
    const cancelledRiderId =
      (order as any).rider?._id?.toString() ?? (order as any).rider?.toString();
    if (cancelledRiderId) {
      await this.pubSub.publish(Events.RIDER_ASSIGNED, {
        [Events.RIDER_ASSIGNED]: {
          riderId: cancelledRiderId,
          origin: 'remove',
          order: cancelled,
        },
      });
    }
    await this.trackingService.terminateOrderTracking(id);

    // The customer previously learned of a restaurant cancellation only via
    // the in-app GraphQL subscription — invisible if the app is backgrounded
    // or closed, which is exactly when a "your order was cancelled" moment
    // matters most. Mirrors the ORDER_ACCEPTED push pattern above.
    const cancelledCustomerClerkId = (cancelled as any).user?.clerkId;
    if (cancelledCustomerClerkId) {
      const wasRefunded = statusUpdate.paymentStatus === 'REFUNDED';
      this.notificationsService
        .sendPushToUser(
          cancelledCustomerClerkId,
          'CUSTOMER',
          'Order cancelled ❌',
          wasRefunded
            ? `${(cancelled as any).restaurant?.name ?? 'The restaurant'} cancelled your order. You've been refunded to your wallet.`
            : `${(cancelled as any).restaurant?.name ?? 'The restaurant'} cancelled your order.`,
          { type: 'ORDER_CANCELLED', orderId: id },
        )
        .catch(() => {});
    }

    return cancelled;
  }

  async orderPickedUp(id: string, restaurantId: string): Promise<OrderDocument> {
    const order = await this.findOrderOrThrow(id);
    const orderRestaurant = String((order as any).restaurant?._id ?? (order as any).restaurant);
    if (orderRestaurant !== restaurantId)
      throw new ForbiddenException('Order does not belong to your restaurant');

    // Conditional filter prevents double-PICKED if rider already marked it
    const raw = await this.orderModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), orderStatus: { $in: ['ACCEPTED', 'ASSIGNED'] } },
        { $set: { orderStatus: 'PICKED', pickedAt: new Date().toISOString() } },
        { new: true },
      )
      .lean()
      .exec();

    // Already PICKED by rider — idempotent, no duplicate event
    if (!raw) return this.findOrderOrThrow(id);

    await this.pushStatusHistory(id, 'PICKED', 'STORE', restaurantId);
    await this.publishOrderStatusChanged(id);
    return this.findOrderOrThrow(id);
  }

  async muteRing(orderId: string): Promise<boolean> {
    await this.orderModel.findByIdAndUpdate(orderId, { $set: { isRinged: true } }).exec();
    return true;
  }

  // ── admin queries/mutations ───────────────────────────────────────────────

  async getOrdersByUserId(
    userId: string,
    page = 1,
    limit = 10,
  ): Promise<{
    orders: OrderDocument[];
    totalCount: number;
    totalPages: number;
    currentPage: number;
    prevPage: boolean;
    nextPage: boolean;
  }> {
    const skip = (page - 1) * limit;
    const query = { user: new Types.ObjectId(userId) };
    const [orders, totalCount] = await Promise.all([
      this.withPopulate(this.orderModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit))
        .lean()
        .exec(),
      this.orderModel.countDocuments(query).exec(),
    ]);
    const totalPages = Math.ceil(totalCount / limit);
    return {
      orders: orders as OrderDocument[],
      totalCount,
      totalPages,
      currentPage: page,
      prevPage: page > 1,
      nextPage: page < totalPages,
    };
  }

  async getAllOrders(page = 1): Promise<OrderDocument[]> {
    const limit = 10;
    const skip = (page - 1) * limit;
    return this.withPopulate(this.orderModel.find().sort({ createdAt: -1 }).skip(skip).limit(limit))
      .lean()
      .exec() as Promise<OrderDocument[]>;
  }

  async getOrdersByRestaurant(
    restaurantId: string,
    page = 1,
    rows = 10,
    search?: string,
  ): Promise<OrderDocument[]> {
    const query: Record<string, unknown> = {
      restaurant: new Types.ObjectId(restaurantId),
    };
    if (search) query.orderId = { $regex: search, $options: 'i' };
    const skip = (page - 1) * rows;
    return this.withPopulate(
      this.orderModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(rows),
    )
      .lean()
      .exec() as Promise<OrderDocument[]>;
  }

  async getOrdersByRestaurantWithoutPagination(
    restaurantId: string,
    search?: string,
  ): Promise<OrderDocument[]> {
    const query: Record<string, unknown> = {
      restaurant: new Types.ObjectId(restaurantId),
    };
    if (search) query.orderId = { $regex: search, $options: 'i' };
    return this.withPopulate(this.orderModel.find(query).sort({ createdAt: -1 }))
      .lean()
      .exec() as Promise<OrderDocument[]>;
  }

  async getActiveOrders(
    restaurantId?: string,
    page = 1,
    rowsPerPage = 10,
    actions?: string[],
    search?: string,
  ): Promise<{ totalCount: number; orders: OrderDocument[] }> {
    const activeStatuses = actions?.length
      ? actions
      : ['PENDING', 'ACCEPTED', 'PREPARED', 'AWAITING_RIDER', 'ASSIGNED', 'PICKED', 'ARRIVED'];

    const query: Record<string, unknown> = { orderStatus: { $in: activeStatuses } };
    if (restaurantId) query.restaurant = new Types.ObjectId(restaurantId);
    if (search) query.orderId = { $regex: search, $options: 'i' };

    const skip = (page - 1) * rowsPerPage;
    const [orders, totalCount] = await Promise.all([
      this.withPopulate(
        this.orderModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(rowsPerPage),
      )
        .lean()
        .exec(),
      this.orderModel.countDocuments(query).exec(),
    ]);

    return { totalCount, orders: orders as OrderDocument[] };
  }

  private buildDateRange(
    startingDate?: string,
    endingDate?: string,
    dateKeyword?: string,
  ): { from: Date; to: Date } | null {
    if (dateKeyword) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const DAY = 86_400_000;
      switch (dateKeyword.toLowerCase()) {
        case 'today':
          return { from: today, to: new Date(today.getTime() + DAY) };
        case 'yesterday': {
          const y = new Date(today.getTime() - DAY);
          return { from: y, to: today };
        }
        case 'week':
        case 'this week':
        case 'weekly': {
          const monday = new Date(today.getTime() - today.getDay() * DAY);
          return { from: monday, to: now };
        }
        case 'month':
        case 'this month':
        case 'monthly':
          return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
        case 'year':
        case 'this year':
        case 'yearly':
          return { from: new Date(now.getFullYear(), 0, 1), to: now };
      }
    }
    if (startingDate || endingDate) {
      return {
        from: startingDate ? new Date(startingDate) : new Date(0),
        to: endingDate ? new Date(endingDate) : new Date(),
      };
    }
    return null;
  }

  async getAllOrdersPaginated(
    page = 1,
    rows = 10,
    startingDate?: string,
    endingDate?: string,
    orderStatus?: string[],
    search?: string,
    dateKeyword?: string,
  ): Promise<{
    totalCount: number;
    currentPage: number;
    totalPages: number;
    prevPage: boolean;
    nextPage: boolean;
    orders: OrderDocument[];
  }> {
    const query: Record<string, unknown> = {};
    if (orderStatus?.length) query.orderStatus = { $in: orderStatus };
    if (search) query.orderId = { $regex: search, $options: 'i' };
    const range = this.buildDateRange(startingDate, endingDate, dateKeyword);
    if (range) {
      query.createdAt = { $gte: range.from, $lte: range.to };
    }

    const skip = (page - 1) * rows;
    const [orders, totalCount] = await Promise.all([
      this.withPopulate(this.orderModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(rows))
        .lean()
        .exec(),
      this.orderModel.countDocuments(query).exec(),
    ]);

    const totalPages = Math.ceil(totalCount / rows);
    return {
      totalCount,
      currentPage: page,
      totalPages,
      prevPage: page > 1,
      nextPage: page < totalPages,
      orders: orders as OrderDocument[],
    };
  }

  async getAllOrdersWithoutPagination(
    startingDate?: string,
    endingDate?: string,
    dateKeyword?: string,
  ): Promise<OrderDocument[]> {
    const query: Record<string, unknown> = {};
    const range = this.buildDateRange(startingDate, endingDate, dateKeyword);
    if (range) {
      query.createdAt = { $gte: range.from, $lte: range.to };
    }
    return this.withPopulate(this.orderModel.find(query).sort({ createdAt: -1 }))
      .lean()
      .exec() as Promise<OrderDocument[]>;
  }

  async updateStatus(id: string, orderStatus: string, override = false): Promise<OrderDocument> {
    const current = await this.orderModel.findById(id, 'orderStatus').lean().exec();
    if (!current) throw new NotFoundException('Order not found');
    const from = (current as any).orderStatus as string;

    // No-op transition: return the order unchanged (idempotent).
    if (from === orderStatus) return this.findOrderOrThrow(id);

    // Route delivery completion through forceCompleteOrder so the dual-confirmation
    // + walletCredited guard credits the rider exactly once. With `override`, an
    // admin may complete from any state (e.g. correcting a wrongly-cancelled order).
    if (orderStatus === 'DELIVERED') {
      const requireArrived = await this.isArrivedStepRequired();
      const allowedFrom = requireArrived ? ['ARRIVED'] : ['PICKED', 'ARRIVED'];
      if (!override && !allowedFrom.includes(from))
        throw new BadRequestException(
          `Invalid order status transition: ${from} → DELIVERED`,
        );
      return this.forceCompleteOrder(id);
    }

    // `override` bypasses the normal transition map. It is exposed only on the
    // admin-guarded resolver and lets an admin correct an order's status after a
    // mistaken transition (e.g. CANCELLED → ACCEPTED).
    if (!override) {
      const allowed = ORDER_STATUS_TRANSITIONS[from];
      if (!allowed) throw new BadRequestException(`Unknown order status: ${from}`);
      if (!allowed.includes(orderStatus))
        throw new BadRequestException(
          `Invalid order status transition: ${from} → ${orderStatus}`,
        );
    }

    const statusUpdate: Record<string, unknown> = { orderStatus };

    // Auto-refund wallet when admin forces a CANCELLED/CANCELLEDBYREST transition.
    // Any captured payment (WALLET or online FLOUCI) is refunded; COD never
    // reaches paymentStatus PAID before delivery.
    if (['CANCELLED', 'CANCELLEDBYREST'].includes(orderStatus)) {
      const fullOrder = await this.findOrderOrThrow(id);
      if ((fullOrder as any).paymentStatus === 'PAID') {
        const refundAmount: number =
          (fullOrder as any).paidAmount ?? (fullOrder as any).orderAmount ?? 0;
        const customerClerkId: string | undefined = (fullOrder as any).user?.clerkId;
        if (refundAmount > 0 && customerClerkId) {
          await this.customerWalletService.credit(customerClerkId, refundAmount, {
            order: id,
            reason: 'REFUND_ADMIN_CANCELLED',
          });
          statusUpdate.paymentStatus = 'REFUNDED';
        }
      }
    }

    const raw = await this.orderModel
      .findByIdAndUpdate(id, { $set: statusUpdate }, { new: true })
      .lean()
      .exec();
    if (!raw) throw new NotFoundException('Order not found');
    await this.pushStatusHistory(id, orderStatus, 'ADMIN');
    await this.publishOrderStatusChanged(id);
    if (['DELIVERED', 'CANCELLED', 'CANCELLEDBYREST'].includes(orderStatus)) {
      await this.trackingService.terminateOrderTracking(id);
    }
    return this.findOrderOrThrow(id);
  }

  async assignRider(id: string, riderId: string): Promise<OrderDocument> {
    const raw = await this.orderModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            rider: new Types.ObjectId(riderId),
            orderStatus: 'AWAITING_RIDER',
            assignedAt: new Date().toISOString(),
          },
        },
        { new: true },
      )
      .lean()
      .exec();
    if (!raw) throw new NotFoundException('Order not found');
    await this.trackingService.terminateOrderTracking(id);
    const populated = await this.findOrderOrThrow(id);
    await this.publishOrderStatusChanged(id);
    this.logger.debug(`[assignRider] publishing RIDER_ASSIGNED riderId=${riderId} orderId=${id}`);
    await this.pubSub.publish(Events.RIDER_ASSIGNED, {
      [Events.RIDER_ASSIGNED]: { riderId, origin: 'call', order: populated },
    });
    // Background push so the rider receives the call even when the app is closed
    const rider = await this.ridersService.findById(riderId);
    this.notificationsService
      .sendIncomingOrderPushToRider({
        riderId,
        notificationToken: (rider as any)?.notificationToken,
        orderId: String((populated as any)._id),
        restaurantName: (populated as any).restaurant?.name ?? 'New Order',
        orderAmount: (populated as any).orderAmount ?? '',
      })
      .catch(() => {});
    return populated;
  }

  async rejectRiderAssignment(riderId: string, orderId: string): Promise<OrderDocument> {
    const order = await this.findOrderOrThrow(orderId);
    const assignedRider = String((order as any).rider?._id ?? (order as any).rider ?? '');
    if (assignedRider !== riderId) throw new ForbiddenException('Order is not assigned to you');
    const raw = await this.orderModel
      .findByIdAndUpdate(orderId, { $set: { rider: null, orderStatus: 'ACCEPTED' } }, { new: true })
      .lean()
      .exec();
    if (!raw) throw new NotFoundException('Order not found');
    this.ridersService.recordAssignmentOutcome(riderId, 'rejected').catch(() => {});
    await this.publishOrderStatusChanged(orderId);
    await this.trackingService.terminateOrderTracking(orderId);
    return this.findOrderOrThrow(orderId);
  }

  // ── rider mutations ───────────────────────────────────────────────────────

  async updateOrderStatusRider(
    id: string,
    riderId: string,
    status: string,
    codCollected?: boolean,
  ): Promise<OrderDocument> {
    const order = await this.findOrderOrThrow(id);
    const assignedRider = String((order as any).rider?._id ?? (order as any).rider ?? '');
    if (assignedRider !== riderId) throw new ForbiddenException('Order is not assigned to you');

    // A rider may only drive the order through its own leg of the pipeline.
    const RIDER_ALLOWED_STATUSES = ['ASSIGNED', 'PICKED', 'ARRIVED', 'DELIVERED'];
    if (!RIDER_ALLOWED_STATUSES.includes(status)) {
      throw new BadRequestException(`Rider cannot set order status to ${status}`);
    }
    if ((order as any).orderStatus === 'AWAITING_RIDER' && status !== 'ASSIGNED') {
      throw new BadRequestException('Must confirm assignment first');
    }

    if (status === 'ARRIVED' && (order as any).orderStatus !== 'PICKED') {
      throw new BadRequestException('Order must be picked up before it can be marked arrived');
    }

    if (status === 'DELIVERED') {
      const requireArrived = await this.isArrivedStepRequired();
      if (requireArrived && (order as any).orderStatus !== 'ARRIVED') {
        throw new BadRequestException('Order must be marked arrived before it can be delivered');
      }
      if ((order as any).paymentMethod === 'COD' && !codCollected) {
        throw new BadRequestException(
          'Cash collection must be confirmed before marking order as delivered',
        );
      }
    }

    const patch: Record<string, unknown> = {};
    const now = new Date().toISOString();
    let arrivalLocation: { latitude: number; longitude: number } | undefined;
    if (status === 'DELIVERED') {
      // Rider confirms delivery — set riderDeliveredAt but stay ARRIVED/PICKED until client also confirms
      patch.riderDeliveredAt = now;
      if (codCollected) patch.codCollectedAt = now;
    } else if (status === 'ARRIVED') {
      arrivalLocation = await this.validateArrivalProximity(id);
      patch.orderStatus = status;
      patch.arrivedAt = now;
      if (arrivalLocation) {
        patch.arrivalLocation = {
          type: 'Point',
          coordinates: [arrivalLocation.longitude, arrivalLocation.latitude],
        };
      }
    } else {
      patch.orderStatus = status;
      if (status === 'PICKED') patch.pickedAt = now;
    }

    await this.orderModel.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean().exec();

    if (status === 'ARRIVED') {
      await this.pushStatusHistory(id, 'ARRIVED', 'RIDER', riderId);
      const customerClerkId = (order as any).user?.clerkId;
      if (customerClerkId) {
        this.notificationsService
          .sendPushToUser(
            customerClerkId,
            'CUSTOMER',
            '🚚 Votre livreur est arrivé',
            'Votre commande est arrivée. Merci de rejoindre votre livreur pour récupérer votre commande.',
            { type: 'ORDER_ARRIVED', orderId: id },
          )
          .catch(() => {});
      }
      await this.publishOrderStatusChanged(id);
    } else if (status === 'PICKED' || status === 'ASSIGNED') {
      await this.pushStatusHistory(id, status, 'RIDER', riderId);
      await this.publishOrderStatusChanged(id);
    } else if (status === 'DELIVERED') {
      await this.finalizeDeliveryIfBothConfirmed(id);
    } else {
      await this.publishOrderStatusChanged(id);
    }

    return this.findOrderOrThrow(id);
  }

  async markOrderDelivered(id: string, userId: string): Promise<OrderDocument> {
    const order = await this.findByIdForUser(id, userId);
    if (!['PICKED', 'ASSIGNED', 'ARRIVED'].includes((order as any).orderStatus)) {
      throw new BadRequestException('Order must be in PICKED, ASSIGNED or ARRIVED status');
    }
    await this.orderModel
      .findByIdAndUpdate(id, { $set: { customerDeliveredAt: new Date().toISOString() } })
      .lean()
      .exec();
    await this.finalizeDeliveryIfBothConfirmed(id);
    return this.findOrderOrThrow(id);
  }

  async finalizeDeliveryIfBothConfirmed(orderId: string): Promise<void> {
    const order = await this.orderModel
      .findById(
        orderId,
        'customerDeliveredAt riderDeliveredAt orderStatus walletCredited riderCommission riderCommissionMinor deliveryCharges deliveryBonus deliveryBonusMinor rider user orderAmount loyaltyPointsUsed',
      )
      .lean()
      .exec();
    if (!order) return;

    const { customerDeliveredAt, riderDeliveredAt, orderStatus, walletCredited } = order as any;
    if (!customerDeliveredAt || !riderDeliveredAt) {
      await this.publishOrderStatusChanged(orderId);
      return;
    }
    if (orderStatus === 'DELIVERED') {
      await this.publishOrderStatusChanged(orderId);
      return;
    }

    const commissionConfig = await this.getRiderCommissionConfig();
    const deliveryCharges: number = (order as any).deliveryCharges ?? 0;
    // A frozen positive commission (the rate promised at dispatch time) is honored;
    // a frozen 0 is treated as "not set" and recomputed from the current rate, so an
    // order prepared while the rate was still 0 can still be credited.
    const frozen = (order as any).riderCommission;
    const riderCommissionMoney =
      frozen && frozen > 0
        ? Number.isSafeInteger((order as any).riderCommissionMinor)
          ? Money.ofMinor((order as any).riderCommissionMinor, commissionConfig)
          : Money.fromDecimal(frozen, commissionConfig)
        : Money.fromDecimal(deliveryCharges, commissionConfig).multiply(String(commissionConfig.rate));
    // The rider's wallet credit is the delivery commission PLUS the platform-funded
    // bonus persisted on the order (auto-computed at placement or set by an admin).
    const deliveryBonusMoney = Number.isSafeInteger((order as any).deliveryBonusMinor)
      ? Money.ofMinor((order as any).deliveryBonusMinor, commissionConfig)
      : Money.fromDecimal((order as any).deliveryBonus ?? 0, commissionConfig);
    const riderEarningsMoney = riderCommissionMoney.add(deliveryBonusMoney);
    const riderEarnings = riderEarningsMoney.toNumber();

    const updated = await this.orderModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(orderId), walletCredited: { $ne: true } },
        {
          $set: {
            orderStatus: 'DELIVERED',
            deliveredAt: new Date().toISOString(),
            walletCredited: true,
            riderEarnings,
            riderEarningsMinor: riderEarningsMoney.toSafeMinorNumber(),
          },
        },
        { new: true },
      )
      .lean()
      .exec();

    if (updated) {
      await this.pushStatusHistory(orderId, 'DELIVERED', 'SYSTEM');
    }

    if (updated && riderEarnings > 0) {
      const riderId = (order as any).rider;
      if (riderId) {
        try {
          await this.riderModel.findByIdAndUpdate(riderId, {
            $inc: { currentWalletAmount: riderEarnings, totalWalletAmount: riderEarnings },
          });
        } catch (err) {
          // The order was marked DELIVERED + walletCredited atomically, but crediting
          // the rider wallet failed. Revert the walletCredited flag so a later
          // finalize call can retry the credit instead of silently losing it.
          await this.orderModel
            .findByIdAndUpdate(orderId, { $set: { walletCredited: false } })
            .exec()
            .catch(() => undefined);
          this.logger.error(
            `[finalizeDelivery] Order ${orderId}: wallet credit failed, reverted walletCredited for retry`,
            err as Error,
          );
        }
      }
    } else if (!updated && !walletCredited) {
      this.logger.warn(`[finalizeDelivery] Order ${orderId}: riderEarnings=0, wallet not credited`);
    }

    await this.publishOrderStatusChanged(orderId);
    await this.trackingService.terminateOrderTracking(orderId);

    // Award loyalty points to the customer (best-effort, never blocks finalization)
    if (updated) {
      const userObjectId = (order as any).user;
      if (userObjectId) {
        const loyaltyConfig = await this.configurationModel
          .findOne({}, 'loyaltyEnabled loyaltyPointsPerUnit')
          .lean()
          .exec();
        const loyaltyEnabled = (loyaltyConfig as any)?.loyaltyEnabled ?? true;
        const pointsPerUnit: number = (loyaltyConfig as any)?.loyaltyPointsPerUnit ?? 10;
        if (loyaltyEnabled && pointsPerUnit > 0) {
          const clerkId = await this.usersService.findClerkIdByMongoId(userObjectId);
          if (clerkId) {
            const orderAmount: number = (order as any).orderAmount ?? 0;
            this.loyaltyService
              .awardPoints(clerkId, orderAmount, pointsPerUnit)
              .catch(() => {});
          }
        }
      }
    }
  }

  async forceCompleteOrder(id: string): Promise<OrderDocument> {
    const now = new Date().toISOString();
    await this.orderModel
      .findByIdAndUpdate(id, {
        $set: {
          customerDeliveredAt: now,
          riderDeliveredAt: now,
        },
      })
      .lean()
      .exec();
    await this.finalizeDeliveryIfBothConfirmed(id);
    return this.findOrderOrThrow(id);
  }

  /**
   * Escalate PREPARED orders that have had no rider claim them for 10–20 minutes.
   * Re-broadcasts with a 15 km radius (vs the initial 8 km) and logs a warning
   * so admin can manually intervene if needed. Uses a fixed time window so each
   * order is only escalated once without requiring a schema change.
   * Runs every 5 minutes.
   */
  /**
   * Every minute: activate SCHEDULED orders whose scheduledFor time has arrived
   * (within a 5-minute lookahead window). Moves them to PENDING and publishes
   * ORDER_PLACED so the restaurant gets the notification exactly on time.
   */
  @Cron('* * * * *')
  async activateScheduledOrders(): Promise<void> {
    const lookahead = new Date(Date.now() + 5 * 60_000).toISOString();
    const due = await this.orderModel
      .find(
        { orderStatus: 'SCHEDULED', scheduledFor: { $lte: lookahead } },
        '_id restaurant zone user',
      )
      .lean()
      .exec();

    if (!due.length) return;
    this.logger.log(`[scheduler] activating ${due.length} scheduled order(s)`);

    for (const raw of due as any[]) {
      const orderId = String(raw._id);
      try {
        // Safety net (path b): the vendor may have edited hours or paused the
        // store between scheduling and activation. Re-check before notifying; a
        // restaurant closed or paused at activation time must not be notified.
        const restaurant = await this.restaurantsService.findOrderOpenStatusInputs(raw.restaurant);
        if (!restaurant) {
          this.logger.warn(`[scheduler] order ${orderId} restaurant missing; skipping`);
          continue;
        }
        const defaultTimezone =
          this.config.get<string>('DEFAULT_RESTAURANT_TIMEZONE') ?? DEFAULT_TIMEZONE_FALLBACK;
        const open =
          (restaurant as any).isActive !== false &&
          evaluateOpen({
            openingTimes: (restaurant as any).openingTimes,
            isAvailable: (restaurant as any).isAvailable,
            timezone: (restaurant as any).timezone ?? defaultTimezone,
          }).isOpen;
        if (!open) {
          // Flag for manual intervention without notifying the (closed) store.
          await this.orderModel
            .findByIdAndUpdate(orderId, {
              $set: { orderStatus: 'SCHEDULED_UNFULFILLED', status: 'pending' },
            })
            .exec();
          this.logger.warn(
            `[scheduler] order ${orderId} not activated — restaurant closed/paused at activation`,
          );
          continue;
        }

        await this.orderModel
          .findByIdAndUpdate(orderId, { $set: { orderStatus: 'PENDING', status: 'pending' } })
          .exec();
        const order = await this.findOrderOrThrow(orderId);
        const restaurantId = String(raw.restaurant);

        const clerkId = raw.user
          ? await this.usersService.findClerkIdByMongoId(raw.user)
          : null;

        // `origin: 'new'` is what the store app's subscription acts on, and no
        // `zoneId`: activation moves the order to PENDING, so it is a store
        // event — riders only hear about it at PREPARED.
        await this.pubSub.publish(Events.ORDER_PLACED, {
          [Events.ORDER_PLACED]: { origin: 'new', restaurantId, order },
        });
        this.notifyStoreNewOrder(order).catch(() => {});

        if (clerkId) {
          this.notificationsService
            .sendPushToUser(
              clerkId,
              'CUSTOMER',
              'Commande programmée activée ⏰',
              'Votre commande est maintenant envoyée au restaurant',
              { type: 'ORDER_SCHEDULED_ACTIVATED', orderId },
            )
            .catch(() => {});
        }
      } catch (err) {
        this.logger.error(`[scheduler] failed to activate order ${orderId}`, err as Error);
      }
    }
  }

  @Cron('*/5 * * * *')
  async escalateUnassignedPreparedOrders(): Promise<void> {
    const ESCALATION_MIN = 10;
    const ESCALATION_MAX = 20;
    const ESCALATION_RADIUS_KM = 15;

    const now = Date.now();
    const windowStart = new Date(now - ESCALATION_MAX * 60_000).toISOString();
    const windowEnd = new Date(now - ESCALATION_MIN * 60_000).toISOString();

    const stale = await this.orderModel
      .find(
        {
          rider: null,
          $or: [
            {
              orderStatus: 'PREPARED',
              preparedAt: { $gte: windowStart, $lte: windowEnd },
            },
            // Riders are dispatched at acceptance too (Sfax field flow), so an
            // ACCEPTED order nobody claimed also deserves a re-broadcast.
            {
              orderStatus: 'ACCEPTED',
              acceptedAt: { $gte: windowStart, $lte: windowEnd },
            },
          ],
        },
        '_id restaurant zone',
      )
      .lean()
      .exec();

    if (!stale.length) return;

    this.logger.warn(
      `[escalation] ${stale.length} order(s) unassigned after ${ESCALATION_MIN} min — re-broadcasting at ${ESCALATION_RADIUS_KM} km`,
    );

    for (const order of stale as any[]) {
      try {
        await this.dispatchNearbyRiders(order as OrderDocument, ESCALATION_RADIUS_KM, 'escalation');
      } catch (err) {
        this.logger.error(
          `[escalation] failed for order ${order._id}`,
          err as Error,
        );
      }
    }
  }

  /**
   * Admin-facing "needs attention" list — the same staleness signal
   * escalateUnassignedPreparedOrders already acts on automatically (unassigned
   * past `thresholdMinutes` in PREPARED/ACCEPTED), but surfaced for a human to
   * see and manually intervene on (call the restaurant, manually reassign),
   * rather than only ever firing a silent re-broadcast. No upper age bound —
   * unlike the escalation cron, an admin should still see an order that's been
   * stuck for hours, not just the first 20-minute window.
   */
  async getOrdersNeedingAttention(thresholdMinutes = 10): Promise<OrderDocument[]> {
    const cutoff = new Date(Date.now() - thresholdMinutes * 60_000).toISOString();
    return this.withPopulate(
      this.orderModel.find({
        rider: null,
        $or: [
          { orderStatus: 'PREPARED', preparedAt: { $lte: cutoff } },
          { orderStatus: 'ACCEPTED', acceptedAt: { $lte: cutoff } },
        ],
      }),
    )
      .sort({ createdAt: 1 })
      .lean()
      .exec() as Promise<OrderDocument[]>;
  }

  /**
   * Auto-confirm deliveries the customer never acknowledged. When a rider has
   * marked an order delivered (riderDeliveredAt set) but the customer has not
   * confirmed within `deliveryAutoConfirmHours`, treat it as confirmed so the
   * rider is credited instead of being stuck PICKED forever. Disabled when the
   * config value is 0/absent. Runs hourly.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async autoConfirmStaleDeliveries(): Promise<void> {
    const config = await this.configurationModel
      .findOne({}, 'deliveryAutoConfirmHours')
      .lean()
      .exec();
    const hours = (config as any)?.deliveryAutoConfirmHours ?? 0;
    if (!hours || hours <= 0) return; // feature disabled

    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const stale = await this.orderModel
      .find(
        {
          orderStatus: 'PICKED',
          walletCredited: { $ne: true },
          riderDeliveredAt: { $ne: null, $lte: cutoff },
        },
        '_id',
      )
      .lean()
      .exec();
    if (!stale.length) return;

    this.logger.log(`[autoConfirm] finalizing ${stale.length} stale delivered order(s)`);
    for (const order of stale as any[]) {
      const orderId = String(order._id);
      try {
        await this.orderModel
          .findByIdAndUpdate(orderId, { $set: { customerDeliveredAt: new Date().toISOString() } })
          .exec();
        await this.finalizeDeliveryIfBothConfirmed(orderId);
      } catch (err) {
        this.logger.error(`[autoConfirm] failed for order ${orderId}`, err as Error);
      }
    }
  }

  /**
   * Every 10 minutes: find active orders past their expectedTime by more than
   * 5 minutes and not yet DELIVERED/CANCELLED. Send a one-time push to the
   * customer ("prend plus de temps que prévu"). Uses etaDelayNotifiedAt guard
   * stored on order to avoid repeat pushes — a simple $set+$ne pattern.
   */
  @Cron('*/10 * * * *')
  async notifyDelayedOrders(): Promise<void> {
    const IN_PROGRESS = [
      'PENDING',
      'ACCEPTED',
      'PREPARED',
      'AWAITING_RIDER',
      'ASSIGNED',
      'PICKED',
      'ARRIVED',
    ];
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();

    const stale = await this.orderModel
      .find(
        {
          orderStatus: { $in: IN_PROGRESS },
          expectedTime: { $lte: fiveMinAgo },
          etaDelayNotified: { $ne: true },
        },
        '_id user',
      )
      .lean()
      .exec();

    if (!stale.length) return;
    this.logger.debug(`[delay-push] ${stale.length} order(s) past ETA`);

    for (const raw of stale as any[]) {
      const orderId = String(raw._id);
      try {
        const marked = await this.orderModel
          .updateOne(
            { _id: raw._id, etaDelayNotified: { $ne: true } },
            { $set: { etaDelayNotified: true } },
          )
          .exec();

        if (marked.modifiedCount > 0 && raw.user) {
          const clerkId = await this.usersService.findClerkIdByMongoId(raw.user);
          if (clerkId) {
            this.notificationsService
              .sendPushToUser(
                clerkId,
                'CUSTOMER',
                'Votre commande prend un peu plus de temps ⏳',
                'Nous faisons tout pour vous livrer le plus vite possible',
                { type: 'ORDER_DELAYED', orderId },
              )
              .catch(() => {});
          }
        }
      } catch (err) {
        this.logger.error(`[delay-push] failed for order ${orderId}`, err as Error);
      }
    }
  }

  // ── reviews ───────────────────────────────────────────────────────────────

  findReviewsByRestaurant(restaurantId: string) {
    return this.reviewModel
      .find({ restaurant: new Types.ObjectId(restaurantId), isActive: true })
      .populate({
        path: 'order',
        select: '_id orderId items user',
        populate: { path: 'user', select: '_id name email' },
      })
      .populate({ path: 'restaurant', select: '_id name image' })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  async assignOrder(riderId: string, orderId: string): Promise<OrderDocument> {
    // Debug: log current order state
    const current = await this.orderModel.findById(orderId).lean().exec();
    this.logger.log(`[assignOrder] riderId=${riderId} orderId=${orderId} | order.orderStatus=${(current as any)?.orderStatus} order.rider=${String((current as any)?.rider ?? 'null')}`);

    // Case 1: rider self-picks from zone (no rider yet, ACCEPTED or PREPARED —
    // the Sfax field flow lets riders claim as soon as the store accepts)
    let raw = await this.orderModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(orderId),
          rider: null,
          orderStatus: { $in: ['ACCEPTED', 'PREPARED'] },
        },
        {
          $set: {
            rider: new Types.ObjectId(riderId),
            orderStatus: 'ASSIGNED',
            assignedAt: new Date().toISOString(),
          },
        },
        { new: true },
      )
      .lean()
      .exec();

    // Case 2: admin pre-assigned to this rider (AWAITING_RIDER) — rider is confirming the call
    if (!raw) {
      raw = await this.orderModel
        .findOneAndUpdate(
          {
            _id: new Types.ObjectId(orderId),
            rider: new Types.ObjectId(riderId),
            orderStatus: 'AWAITING_RIDER',
          },
          { $set: { orderStatus: 'ASSIGNED', assignedAt: new Date().toISOString() } },
          { new: true },
        )
        .lean()
        .exec();
    }

    this.logger.log(`[assignOrder] result: ${raw ? 'OK → ASSIGNED' : 'FAILED (no match)'}`);
    if (!raw) throw new ConflictException('Order already claimed by another rider');
    this.ridersService.recordAssignmentOutcome(riderId, 'accepted').catch(() => {});
    await this.trackingService.terminateOrderTracking(orderId);
    const populated = await this.findOrderOrThrow(orderId);
    // Same populated-`zone` caveat as markOrderPrepared — read `._id` first.
    const zoneId = (populated as any).zone?._id?.toString() ?? (populated as any).zone?.toString();
    const restaurantId = String(
      (populated as any).restaurant?._id ?? (populated as any).restaurant,
    );
    await this.publishOrderStatusChanged(orderId);
    await this.pubSub.publish(Events.RIDER_ASSIGNED, {
      [Events.RIDER_ASSIGNED]: { riderId, origin: 'assign', order: populated },
    });
    if (zoneId) {
      await this.pubSub.publish(Events.ORDER_PLACED, {
        [Events.ORDER_PLACED]: { origin: 'remove', restaurantId, zoneId, order: populated },
      });
    }
    return populated;
  }

  async findByRiderId(riderObjectId: string): Promise<OrderDocument[]> {
    return this.orderModel
      .find({ rider: new Types.ObjectId(riderObjectId) })
      .populate(POPULATE_RESTAURANT)
      .populate(POPULATE_USER)
      .populate(POPULATE_RIDER)
      .lean()
      .exec() as unknown as OrderDocument[];
  }

  async findVisibleForRider(rider: RiderDocument): Promise<OrderDocument[]> {
    const riderId = new Types.ObjectId(String((rider as any)._id));
    const riderZoneId = (rider as any).zone?._id ?? (rider as any).zone;
    const filters: Record<string, unknown>[] = [{ rider: riderId }];

    if (riderZoneId) {
      filters.push({
        rider: null,
        zone: new Types.ObjectId(String(riderZoneId)),
        orderStatus: { $in: ['ACCEPTED', 'PREPARED'] },
        isPickedUp: { $ne: true },
      });
    }

    return this.orderModel
      .find({ $or: filters })
      .populate(POPULATE_RESTAURANT)
      .populate(POPULATE_USER)
      .populate(POPULATE_RIDER)
      .lean()
      .exec() as unknown as OrderDocument[];
  }
}
