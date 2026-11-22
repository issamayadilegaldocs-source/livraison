import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OfferDocument = HydratedDocument<Offer>;

export const OFFER_TYPES = ['FIXED', 'PERCENTAGE'] as const;
export const OFFER_SCOPES = ['CART', 'ITEMS'] as const;

@Schema({ collection: 'offers', timestamps: true })
export class Offer {
  @Prop({ type: Types.ObjectId, ref: 'Restaurant', required: true, index: true })
  restaurant!: Types.ObjectId;

  @Prop() title?: string;

  @Prop({ type: String, enum: OFFER_TYPES, required: true })
  type!: string;

  /** For PERCENTAGE: 1–100 (percent off). For FIXED: absolute currency amount. */
  @Prop({ required: true }) value!: number;

  @Prop({ required: true }) startsAt!: Date;
  @Prop({ required: true, index: true }) endsAt!: Date;

  /** CART = whole-cart subtotal; ITEMS = only matched foods/categories. */
  @Prop({ type: String, enum: OFFER_SCOPES, default: 'CART' })
  scope?: string;

  @Prop({ type: [String], default: [] }) targetFoodIds?: string[];
  @Prop({ type: [String], default: [] }) targetCategoryIds?: string[];

  /** Offer only applies when cart subtotal ≥ this. */
  @Prop() minOrderAmount?: number;

  /** Discount is clamped to at most this amount. */
  @Prop() maxDiscount?: number;

  /** Vendor/admin moderation switch; cancelling an offer sets this false. */
  @Prop({ default: true }) enabled?: boolean;

  /** When the zone marketing push was last sent for this offer (rate-limit). */
  @Prop() lastNotifiedAt?: Date;

  /** Dedupe key for create (Idempotency-Key); see offers.service. */
  @Prop({ type: String }) idempotencyKey?: string;
}

export const OfferSchema = SchemaFactory.createForClass(Offer);
OfferSchema.index({ restaurant: 1, endsAt: 1 });
OfferSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });
