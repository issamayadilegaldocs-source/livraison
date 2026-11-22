import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CouponDocument = HydratedDocument<Coupon>;

@Schema({ collection: 'coupons', timestamps: true })
export class Coupon {
  @Prop({ required: true }) title!: string;
  @Prop({ default: 0 }) discount?: number;
  @Prop({ default: true }) enabled?: boolean;
  @Prop() startDate?: string;
  @Prop() endDate?: string;
  @Prop({ default: false }) lifeTimeActive?: boolean;
  /** Optional restaurant scope; null means platform-wide coupon. */
  @Prop({ type: Types.ObjectId, ref: 'Restaurant', index: true, sparse: true })
  restaurant?: Types.ObjectId;
  /**
   * Maximum number of times this coupon may be redeemed across all customers.
   * 0 (or unset) means unlimited. `usageLimit: 1` makes it single-use. Enforced
   * atomically at order placement via `$inc` guarded by `timesUsed < usageLimit`.
   */
  @Prop({ default: 0 }) usageLimit?: number;
  /** Redemptions claimed so far. Incremented on placement, decremented on cancel. */
  @Prop({ default: 0 }) timesUsed?: number;
}

export const CouponSchema = SchemaFactory.createForClass(Coupon);
