import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Coupon, CouponDocument } from './coupon.schema';
import { CouponInput } from './dto/coupon.input';
import { ApplyCouponResponse } from './dto/apply-coupon.response';

@Injectable()
export class CouponsService {
  constructor(
    @InjectModel(Coupon.name) private readonly couponModel: Model<CouponDocument>,
  ) {}

  findAll(): Promise<CouponDocument[]> {
    return this.couponModel.find().sort({ createdAt: -1 }).lean().exec() as Promise<CouponDocument[]>;
  }

  findByRestaurant(restaurantId: string): Promise<CouponDocument[]> {
    return this.couponModel
      .find({ restaurant: new Types.ObjectId(restaurantId) })
      .sort({ createdAt: -1 })
      .lean()
      .exec() as Promise<CouponDocument[]>;
  }

  create(input: CouponInput): Promise<CouponDocument> {
    return this.couponModel.create({
      title: input.title,
      discount: input.discount ?? 0,
      enabled: input.enabled ?? true,
      startDate: input.startDate,
      endDate: input.endDate,
      lifeTimeActive: input.lifeTimeActive ?? false,
      usageLimit: input.usageLimit ?? 0,
    });
  }

  async edit(input: CouponInput): Promise<CouponDocument> {
    if (!input._id) throw new BadRequestException('_id is required');
    const patch: Record<string, unknown> = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.discount !== undefined) patch.discount = input.discount;
    if (input.enabled !== undefined) patch.enabled = input.enabled;
    if (input.startDate !== undefined) patch.startDate = input.startDate;
    if (input.endDate !== undefined) patch.endDate = input.endDate;
    if (input.lifeTimeActive !== undefined) patch.lifeTimeActive = input.lifeTimeActive;
    if (input.usageLimit !== undefined) patch.usageLimit = input.usageLimit;

    const updated = await this.couponModel
      .findByIdAndUpdate(input._id, { $set: patch }, { new: true })
      .lean()
      .exec();
    if (!updated) throw new NotFoundException('Coupon not found');
    return updated as CouponDocument;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await this.couponModel.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException('Coupon not found');
    return true;
  }

  // ── Restaurant-scoped coupon methods ─────────────────────────────────────

  createRestaurantCoupon(restaurantId: string, input: CouponInput): Promise<CouponDocument> {
    return this.couponModel.create({
      title: input.title,
      discount: input.discount ?? 0,
      enabled: input.enabled ?? true,
      startDate: input.startDate,
      endDate: input.endDate,
      lifeTimeActive: input.lifeTimeActive ?? false,
      usageLimit: input.usageLimit ?? 0,
      restaurant: new Types.ObjectId(restaurantId),
    });
  }

  async editRestaurantCoupon(restaurantId: string, input: CouponInput): Promise<CouponDocument> {
    if (!input._id) throw new BadRequestException('_id is required');
    const patch: Record<string, unknown> = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.discount !== undefined) patch.discount = input.discount;
    if (input.enabled !== undefined) patch.enabled = input.enabled;
    if (input.startDate !== undefined) patch.startDate = input.startDate;
    if (input.endDate !== undefined) patch.endDate = input.endDate;
    if (input.lifeTimeActive !== undefined) patch.lifeTimeActive = input.lifeTimeActive;
    if (input.usageLimit !== undefined) patch.usageLimit = input.usageLimit;

    const updated = await this.couponModel
      .findOneAndUpdate(
        { _id: input._id, restaurant: new Types.ObjectId(restaurantId) },
        { $set: patch },
        { new: true },
      )
      .lean()
      .exec();
    if (!updated) throw new NotFoundException('Coupon not found for this restaurant');
    return updated as CouponDocument;
  }

  async deleteRestaurantCoupon(restaurantId: string, couponId: string): Promise<boolean> {
    const deleted = await this.couponModel
      .findOneAndDelete({ _id: couponId, restaurant: new Types.ObjectId(restaurantId) })
      .exec();
    if (!deleted) throw new NotFoundException('Coupon not found for this restaurant');
    return true;
  }

  async applyCoupon(code: string, restaurantId: string): Promise<ApplyCouponResponse> {
    const coupon = await this.couponModel.findOne({ title: code }).lean().exec() as CouponDocument | null;

    if (!coupon) return { coupon: undefined, message: 'Coupon not found', success: false };
    if (!coupon.enabled) return { coupon: undefined, message: 'Coupon is disabled', success: false };

    // Restaurant-scoped coupons are only valid for their own restaurant
    if ((coupon as any).restaurant && String((coupon as any).restaurant) !== String(restaurantId))
      return { coupon: undefined, message: 'Coupon is not valid for this restaurant', success: false };

    if (!coupon.lifeTimeActive) {
      const now = new Date();
      if (coupon.startDate && new Date(coupon.startDate) > now)
        return { coupon: undefined, message: 'Coupon not yet active', success: false };
      if (coupon.endDate && new Date(coupon.endDate) < now)
        return { coupon: undefined, message: 'Coupon has expired', success: false };
    }

    return { coupon: coupon as any, message: 'Coupon applied successfully', success: true };
  }

  /**
   * Atomically claim one redemption of a usage-limited coupon. Returns true when
   * the use was reserved. The `$expr: timesUsed < usageLimit` guard lives inside
   * the update filter, so concurrent placements of a single-use code can never
   * both succeed — exactly one wins the `findOneAndUpdate`, the rest get false.
   * Unlimited coupons (usageLimit ≤ 0) are not passed here by the caller.
   */
  async claimUse(couponId: string | Types.ObjectId, usageLimit: number): Promise<boolean> {
    if (!(usageLimit > 0)) return true;
    const claimed = await this.couponModel
      .findOneAndUpdate(
        {
          _id: couponId,
          $expr: { $lt: [{ $ifNull: ['$timesUsed', 0] }, usageLimit] },
        },
        { $inc: { timesUsed: 1 } },
      )
      .lean()
      .exec();
    return !!claimed;
  }

  /**
   * Release one previously-claimed redemption (order rolled back or cancelled).
   * Floors at zero so a double release can never drive the counter negative.
   */
  async releaseUse(couponId: string | Types.ObjectId): Promise<void> {
    await this.couponModel
      .updateOne({ _id: couponId, timesUsed: { $gt: 0 } }, { $inc: { timesUsed: -1 } })
      .exec();
  }
}
