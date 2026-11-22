import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';
import { createClerkClient } from '@clerk/backend';
import { ConfigService } from '@nestjs/config';
import { Restaurant, RestaurantDocument } from './restaurant.schema';
import { MoneyCurrency } from '../common/money/money';
import { buildWalletWithdrawalUpdate } from '../common/money/wallet-withdrawal-update';
import { Zone, ZoneDocument } from '../zones/zone.schema';
import { Owner, OwnerDocument } from '../owners/owner.schema';
import { RestaurantInput, RestaurantProfileInput, BussinessDetailsInput } from './dto/restaurant.input';
import { CoordinatesInput, PolygonInput, CircleBoundsInput } from '../common/dto/geo.input';
import { RestaurantPreviewModel } from './restaurant.model';
import { normalizeTimeValue } from '../common/scalars/time-value.scalar';
import { GoogleTimezoneProvider } from '../providers/google-timezone.provider';

export interface OrderOpenStatusInputs {
  isActive?: boolean;
  isAvailable?: boolean;
  openingTimes?: unknown[];
  timezone?: string;
}

@Injectable()
export class RestaurantWalletService {
  private readonly logger = new Logger(RestaurantWalletService.name);

  constructor(
    @InjectModel(Restaurant.name)
    private readonly restaurantModel: Model<RestaurantDocument>,
  ) {}

  async getCommissionRate(storeId: string): Promise<number> {
    const restaurant = await this.restaurantModel
      .findById(storeId, 'commissionRate')
      .lean()
      .exec();
    return Math.max(0, Math.min(1, (restaurant as any)?.commissionRate ?? 0.1));
  }

  async getWalletContext(
    clerkId: string,
  ): Promise<{ id: string; currentWalletAmount: number; currentWalletAmountMinor?: number } | null> {
    const restaurant = await this.restaurantModel
      .findOne({ clerkId }, '_id currentWalletAmount currentWalletAmountMinor')
      .lean()
      .exec();
    if (!restaurant) return null;
    return {
      id: String((restaurant as any)._id),
      currentWalletAmount: (restaurant as any).currentWalletAmount ?? 0,
      currentWalletAmountMinor: (restaurant as any).currentWalletAmountMinor,
    };
  }

  async debitWalletForWithdrawal(
    restaurantId: string,
    amount: number,
    amountMinor?: number,
    currencyConfig?: MoneyCurrency,
  ): Promise<void> {
    await this.restaurantModel.findByIdAndUpdate(
      restaurantId,
      buildWalletWithdrawalUpdate({
        amount,
        amountMinor,
        currencyConfig,
        direction: 'debit',
      }),
    );
  }

  async creditWalletForWithdrawal(
    restaurantId: string,
    amount: number,
    amountMinor?: number,
    currencyConfig?: MoneyCurrency,
  ): Promise<void> {
    await this.restaurantModel.findByIdAndUpdate(
      restaurantId,
      buildWalletWithdrawalUpdate({
        amount,
        amountMinor,
        currencyConfig,
        direction: 'credit',
      }),
    );
  }

  async commissionRate(page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [restaurants, totalCount] = await Promise.all([
      this.restaurantModel
        .find({}, '_id unique_restaurant_id orderId orderPrefix name commissionRate')
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.restaurantModel.countDocuments().exec(),
    ]);

    const totalPages = Math.ceil(totalCount / limit);
    return {
      restaurant: restaurants,
      currentPage: page,
      totalPages,
      nextPage: page < totalPages,
      prevPage: page > 1,
    };
  }
}
