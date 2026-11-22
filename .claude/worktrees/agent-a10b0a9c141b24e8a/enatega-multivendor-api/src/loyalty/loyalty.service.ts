import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LoyaltyAccount, LoyaltyAccountDocument } from './loyalty-account.schema';
import { Money, MoneyCurrency } from '../common/money/money';

@Injectable()
export class LoyaltyService {
  private readonly logger = new Logger(LoyaltyService.name);

  constructor(
    @InjectModel(LoyaltyAccount.name)
    private readonly model: Model<LoyaltyAccountDocument>,
  ) {}

  async getOrCreate(userId: string): Promise<LoyaltyAccountDocument> {
    const existing = await this.model.findOne({ userId }).exec();
    if (existing) return existing;
    return this.model.create({ userId, points: 0, lifetimePoints: 0 });
  }

  async getBalance(userId: string): Promise<LoyaltyAccountDocument> {
    return this.getOrCreate(userId);
  }

  /**
   * Award points after a delivered order.
   * points = floor(orderAmount * pointsPerUnit)
   */
  async awardPoints(
    userId: string,
    orderAmount: number,
    pointsPerUnit: number,
  ): Promise<void> {
    if (pointsPerUnit <= 0 || orderAmount <= 0) return;
    const earned = Math.floor(orderAmount * pointsPerUnit);
    if (earned <= 0) return;

    await this.model
      .findOneAndUpdate(
        { userId },
        { $inc: { points: earned, lifetimePoints: earned } },
        { upsert: true },
      )
      .exec();

    this.logger.debug(`[loyalty] +${earned} pts awarded to ${userId}`);
  }

  /**
   * Validate and deduct points at checkout.
   * Returns the monetary discount value.
   * Throws BadRequestException if user has insufficient points.
   */
  async redeemPoints(
    userId: string,
    pointsToRedeem: number,
    redemptionRate: number,
    currencyConfig: MoneyCurrency = {},
  ): Promise<number> {
    if (pointsToRedeem <= 0) return 0;
    if (redemptionRate <= 0) throw new BadRequestException('Loyalty redemption is not configured');

    // Ensure the account row exists, but the actual balance check must happen
    // atomically in the update filter below — reading `account.points` here
    // and deducting separately is a TOCTOU race: two concurrent redemptions
    // can both pass the read-check before either write lands, driving the
    // balance negative.
    await this.getOrCreate(userId);

    const discount = this.pointsValue(pointsToRedeem, redemptionRate, currencyConfig);

    const updated = await this.model
      .findOneAndUpdate(
        { userId, points: { $gte: pointsToRedeem } },
        { $inc: { points: -pointsToRedeem } },
      )
      .exec();

    if (!updated) {
      const current = await this.getOrCreate(userId);
      throw new BadRequestException(
        `Insufficient loyalty points (have ${current.points}, need ${pointsToRedeem})`,
      );
    }

    this.logger.debug(`[loyalty] -${pointsToRedeem} pts redeemed by ${userId} → ${discount} discount`);
    return discount;
  }

  pointsValue(
    points: number,
    redemptionRate: number,
    currencyConfig: MoneyCurrency = {},
  ): number {
    if (points <= 0 || redemptionRate <= 0) return 0;
    return Money.fromDecimal(points / redemptionRate, currencyConfig).toNumber();
  }

  /**
   * Refund points if an order is cancelled after redemption.
   */
  async refundPoints(userId: string, pointsToRefund: number): Promise<void> {
    if (pointsToRefund <= 0) return;
    await this.model
      .findOneAndUpdate(
        { userId },
        { $inc: { points: pointsToRefund } },
        { upsert: true },
      )
      .exec();
    this.logger.debug(`[loyalty] +${pointsToRefund} pts refunded to ${userId}`);
  }
}
