import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OrderDocument = HydratedDocument<Order>;

// ── Embedded sub-schemas ───────────────────────────────────────────────────

@Schema({ _id: true, timestamps: false })
class OrderItemVariation {
  @Prop() title?: string;
  @Prop() price?: number;
  @Prop() discounted?: number;
}
const OrderItemVariationSchema = SchemaFactory.createForClass(OrderItemVariation);

@Schema({ _id: true, timestamps: false })
class OrderItemAddonOption {
  @Prop() title?: string;
  @Prop() description?: string;
  @Prop() price?: number;
}
const OrderItemAddonOptionSchema = SchemaFactory.createForClass(OrderItemAddonOption);

@Schema({ _id: true, timestamps: false })
class OrderItemAddon {
  @Prop({ type: [OrderItemAddonOptionSchema], default: [] }) options?: OrderItemAddonOption[];
  @Prop() title?: string;
  @Prop() description?: string;
  @Prop() quantityMinimum?: number;
  @Prop() quantityMaximum?: number;
}
const OrderItemAddonSchema = SchemaFactory.createForClass(OrderItemAddon);

@Schema({ _id: true, timestamps: true })
class OrderItem {
  @Prop() title?: string;
  @Prop() food?: string;
  @Prop() description?: string;
  @Prop() image?: string;
  @Prop() quantity?: number;
  @Prop({ type: OrderItemVariationSchema }) variation?: OrderItemVariation;
  @Prop({ type: [OrderItemAddonSchema], default: [] }) addons?: OrderItemAddon[];
  @Prop() specialInstructions?: string;
  @Prop({ default: true }) isActive?: boolean;
}
const OrderItemSchema = SchemaFactory.createForClass(OrderItem);

@Schema({ _id: false })
class OrderGeoPoint {
  @Prop({ type: String, enum: ['Point'], default: 'Point' })
  type?: string;

  @Prop({ type: [Number] })
  coordinates?: number[];
}
const OrderGeoPointSchema = SchemaFactory.createForClass(OrderGeoPoint);

@Schema({ _id: false, timestamps: false })
class OrderStatusEvent {
  @Prop() status?: string;
  @Prop() at?: string;
  // ADMIN | RIDER | STORE | CUSTOMER | SYSTEM
  @Prop() actor?: string;
  @Prop() actorId?: string;
}
const OrderStatusEventSchema = SchemaFactory.createForClass(OrderStatusEvent);

@Schema({ _id: true, timestamps: false })
class OrderDeliveryAddress {
  @Prop({ type: OrderGeoPointSchema })
  location?: { type: string; coordinates: number[] };
  @Prop() deliveryAddress?: string;
  @Prop() details?: string;
  @Prop() label?: string;
}
const OrderDeliveryAddressSchema = SchemaFactory.createForClass(OrderDeliveryAddress);

// ── Main Order schema ──────────────────────────────────────────────────────

@Schema({ collection: 'orders', timestamps: true })
export class Order {
  @Prop() orderId?: string;

  @Prop({ type: Types.ObjectId, ref: 'Restaurant', index: true })
  restaurant?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  user?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Rider', index: true })
  rider?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Review' })
  review?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Zone' })
  zone?: Types.ObjectId;

  @Prop({ type: [OrderItemSchema], default: [] }) items?: OrderItem[];

  @Prop({ type: OrderDeliveryAddressSchema }) deliveryAddress?: OrderDeliveryAddress;

  @Prop() paymentMethod?: string;
  @Prop({ default: 0 }) paidAmount?: number;
  @Prop() paidAmountMinor?: number;
  @Prop({ default: 0 }) orderAmount?: number;
  @Prop() orderAmountMinor?: number;
  @Prop() orderAmountCurrency?: string;
  @Prop() orderAmountScale?: number;

  @Prop({ default: 'PENDING', index: true }) orderStatus?: string;
  @Prop({ default: 'pending' }) status?: string;
  // Client-supplied Idempotency-Key from placeOrder — lets a retried
  // request (reconnect after a network drop, accidental double-submit)
  // return the order that was already created instead of placing (and
  // charging) a second one. Sparse+unique so orders placed without a key
  // are unaffected and two orders can never share a real key.
  @Prop({ type: String }) placementIdempotencyKey?: string;
  // UNPAID | PAID | REFUNDED
  @Prop({ default: 'UNPAID' }) paymentStatus?: string;

  // ── Online payment (Flouci) ────────────────────────────────────────────────
  @Prop() paymentProvider?: string; // e.g. 'FLOUCI'
  @Prop() paymentReference?: string; // gateway payment_id
  @Prop() paymentLink?: string; // hosted checkout link
  @Prop() paidAt?: string;

  @Prop() reason?: string;
  @Prop({ default: true }) isActive?: boolean;

  // Pre-discount menu subtotal (Σ price×qty). Persisted so the settlement split
  // can charge restaurant commission on the original subtotal, not the discounted
  // food — the platform, not the restaurant, absorbs promo discounts.
  @Prop({ default: 0 }) subtotal?: number;
  @Prop() subtotalMinor?: number;
  @Prop({ default: 0 }) deliveryCharges?: number;
  @Prop() deliveryChargesMinor?: number;
  @Prop({ default: 0 }) tipping?: number;
  @Prop() tippingMinor?: number;
  @Prop({ default: 0 }) taxationAmount?: number;
  @Prop() taxationAmountMinor?: number;
  @Prop() couponCode?: string;
  /** Coupon document redeemed on this order; set only for usage-limited coupons
   * so the redemption can be released on cancellation. */
  @Prop({ type: Types.ObjectId, ref: 'Coupon' }) coupon?: Types.ObjectId;
  @Prop({ default: 0 }) discountAmount?: number;
  @Prop() discountAmountMinor?: number;
  @Prop({ type: Types.ObjectId, ref: 'Offer' }) offer?: Types.ObjectId;

  @Prop() orderDate?: string;
  @Prop() expectedTime?: string;
  @Prop() completionTime?: string;
  @Prop() preparationTime?: string;

  @Prop({ default: false }) isPickedUp?: boolean;
  @Prop() instructions?: string;

  @Prop() acceptedAt?: string;
  @Prop() pickedAt?: string;
  @Prop() arrivedAt?: string;
  @Prop() deliveredAt?: string;
  @Prop() cancelledAt?: string;
  @Prop() assignedAt?: string;
  @Prop() codCollectedAt?: string;

  // Rider's last-known coordinates at the moment ARRIVED was recorded, captured
  // from tracking's live-location Redis key (best-effort — absent if the GPS
  // proximity check was skipped or the rider had no recent location on file).
  @Prop({ type: OrderGeoPointSchema }) arrivalLocation?: { type: string; coordinates: number[] };

  // Append-only audit trail of orderStatus transitions. Best-effort: a failed
  // push never blocks the underlying transition it is recording.
  @Prop({ type: [OrderStatusEventSchema], default: [] }) statusHistory?: OrderStatusEvent[];

  @Prop({ default: false }) isRinged?: boolean;
  @Prop({ default: false }) isRiderRinged?: boolean;

  // ── New delivery lifecycle fields ──────────────────────────────────────────
  @Prop() preparedAt?: string;
  @Prop() customerDeliveredAt?: string;
  @Prop() riderDeliveredAt?: string;
  @Prop({ default: 0 }) riderCommission?: number;
  @Prop() riderCommissionMinor?: number;
  // Platform-funded bonus added to rider pay; NOT part of the customer total.
  // Auto-defaulted at placement from config, overridable per order by an admin.
  @Prop({ default: 0 }) deliveryBonus?: number;
  @Prop() deliveryBonusMinor?: number;
  @Prop({ default: 0 }) riderEarnings?: number;
  @Prop() riderEarningsMinor?: number;
  @Prop({ default: false }) walletCredited?: boolean;
  @Prop({ default: false }) nearbyNotificationSent?: boolean;
  @Prop() scheduledFor?: string;
  @Prop({ default: 0 }) loyaltyPointsUsed?: number;
  @Prop({ default: 0 }) loyaltyDiscount?: number;
  @Prop() loyaltyDiscountMinor?: number;
  @Prop({ default: false }) isExpress?: boolean;
  @Prop({ default: 0 }) expressSurcharge?: number;
  @Prop() expressSurchargeMinor?: number;
  // Customer service/platform fee charged on the discounted food amount.
  @Prop({ default: 0 }) serviceFee?: number;
  @Prop() serviceFeeMinor?: number;
  @Prop({ default: false }) etaDelayNotified?: boolean;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

// Matches orders.service.ts#getActiveOrders / #getOrdersByRestaurant — the
// store dashboard's most frequent query (restaurant + status filter, sorted
// by recency). Without this, only the single-field `restaurant` or
// `orderStatus` index is used and the rest is an in-memory filter/sort.
OrderSchema.index({ restaurant: 1, orderStatus: 1, createdAt: -1 });

// Matches orders.service.ts#findVisibleForRider's zone/status fallback branch
// (`{ rider: null, zone, orderStatus: { $in: [...] } }`) — the rider
// heartbeat-fallback dispatch poll hit by every online rider without an
// active Redis assignment. `zone` had no index at all before this, so this
// branch was a full collection scan on every fallback poll.
OrderSchema.index({ zone: 1, orderStatus: 1 });

OrderSchema.index({ placementIdempotencyKey: 1 }, { unique: true, sparse: true });

// Matches orders.service.ts#getOrdersNeedingAttention (`{ rider: null, $or:
// [{orderStatus:'PREPARED',...}, {orderStatus:'ACCEPTED',...}], sort:
// createdAt }`) and the Fleet & Dispatch Operations Center's equivalent
// unassigned-order reads: OperationsService's cityWideUnassignedCount
// (getOperationalAlerts) and crisisSnapshot's unassignedOrdersCount
// (`{orderStatus:'PREPARED', rider:null}`). ESR-ordered: rider/orderStatus
// are equality filters, createdAt is the sort field.
OrderSchema.index({ rider: 1, orderStatus: 1, createdAt: 1 });
