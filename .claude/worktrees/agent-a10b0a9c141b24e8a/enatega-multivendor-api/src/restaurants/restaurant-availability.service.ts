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
export class RestaurantAvailabilityService {
  private readonly logger = new Logger(RestaurantAvailabilityService.name);

  constructor(
    @InjectModel(Restaurant.name)
    private readonly restaurantModel: Model<RestaurantDocument>,
  ) {}

  async setNotificationToken(
    restaurant: RestaurantDocument,
    token?: string,
  ): Promise<void> {
    if (token && restaurant.notificationToken !== token) {
      restaurant.notificationToken = token;
      await restaurant.save();
    }
  }

  async updateNotificationPrefs(
    restaurantId: string,
    isOrderNotification: boolean,
    isOfferNotification: boolean,
  ): Promise<RestaurantDocument> {
    const updated = await this.restaurantModel
      .findByIdAndUpdate(
        restaurantId,
        { $set: { isOrderNotification, isOfferNotification } },
        { new: true },
      )
      .exec();
    if (!updated) throw new NotFoundException('Restaurant not found');
    return updated;
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
    const restaurant = await this.restaurantModel
      .findOne({ clerkId, isActive: { $ne: false } })
      .lean()
      .exec();
    if (!restaurant) throw new NotFoundException('Restaurant not found');

    // A store is available unless explicitly paused (isAvailable === false).
    // Treating undefined/null as "available" matches the order gate and the
    // store UI, so toggling a legacy doc (no field) correctly pauses it.
    const currentlyAvailable = (restaurant as any).isAvailable !== false;
    const nextAvailable = !currentlyAvailable;
    const set: Record<string, unknown> = { isAvailable: nextAvailable };
    if (nextAvailable) {
      // Going back online — cancel any scheduled auto-resume.
      set.unavailableUntil = null;
    } else if (pauseMinutes && pauseMinutes > 0) {
      // Pausing with a timer — schedule the automatic resume.
      set.unavailableUntil = new Date(Date.now() + pauseMinutes * 60_000);
    } else {
      // Pausing indefinitely.
      set.unavailableUntil = null;
    }

    const updated = await this.restaurantModel
      .findByIdAndUpdate((restaurant as any)._id, { $set: set }, { new: true })
      .lean()
      .exec();
    if (!updated) throw new NotFoundException('Restaurant not found');
    return updated as RestaurantDocument;
  }

/**
   * Every minute: re-enable any store whose timed pause has elapsed.
   * Stores paused indefinitely (unavailableUntil null) are left untouched.
   */
  @Cron('* * * * *')
  async autoResumeStores(): Promise<void> {
    const res = await this.restaurantModel
      .updateMany(
        { isAvailable: false, unavailableUntil: { $ne: null, $lte: new Date() } },
        { $set: { isAvailable: true, unavailableUntil: null } },
      )
      .exec();
    if (res.modifiedCount) {
      this.logger.log(`[autoResumeStores] re-enabled ${res.modifiedCount} store(s)`);
    }
  }

  async saveNotificationToken(
    clerkId: string,
    token: string | undefined,
    isEnabled: boolean | undefined,
  ): Promise<RestaurantDocument> {
    const patch: Record<string, unknown> = {};
    if (token !== undefined) patch.notificationToken = token;
    if (isEnabled !== undefined) patch.enableNotification = isEnabled;
    const updated = await this.restaurantModel
      .findOneAndUpdate({ clerkId, isActive: { $ne: false } }, { $set: patch }, { new: true })
      .lean()
      .exec();
    if (!updated) throw new NotFoundException(`Restaurant not found`);
    return updated as RestaurantDocument;
  }

  async clearNotificationToken(token: string): Promise<number> {
    const result = await this.restaurantModel
      .updateMany({ notificationToken: token }, { $unset: { notificationToken: 1 } })
      .exec();
    return result.modifiedCount;
  }
}
