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
export class RestaurantZonesService {
  private readonly logger = new Logger(RestaurantZonesService.name);

  constructor(
    @InjectModel(Restaurant.name)
    private readonly restaurantModel: Model<RestaurantDocument>,
    @InjectModel(Zone.name)
    private readonly zoneModel: Model<ZoneDocument>,
  ) {}

  async isAddressInDeliveryBounds(
    restaurantId: string,
    coordinates: number[],
  ): Promise<boolean> {
    const [lng, lat] = coordinates;
    const inZone = await this.restaurantModel
      .findOne({
        _id: new Types.ObjectId(restaurantId),
        deliveryBounds: {
          $geoIntersects: { $geometry: { type: 'Point', coordinates: [lng, lat] } },
        },
      })
      .lean()
      .exec();
    return Boolean(inZone);
  }

// Resolve a restaurant's working zone from its GPS point. Stored
  // `restaurant.zone` is legacy data and must not drive dispatch.
  async findZoneByRestaurantLocation(
    restaurant: { location?: { coordinates?: number[] } },
  ): Promise<ZoneDocument | null> {
    return this.findZoneByPoint(restaurant.location?.coordinates);
  }

  async findZoneByPoint(coordinates?: number[]): Promise<ZoneDocument | null> {
    if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
    const [longitude, latitude] = coordinates.map(Number);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
    return this.zoneModel
      .findOne({
        isActive: true,
        location: {
          $geoIntersects: {
            $geometry: { type: 'Point', coordinates: [longitude, latitude] },
          },
        },
      })
      .lean()
      .exec() as Promise<ZoneDocument | null>;
  }

// Resolve a legacy zone ObjectId for old clients that still hold an id.
  async findZoneById(id: string): Promise<ZoneDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.zoneModel.findById(id).lean().exec() as Promise<ZoneDocument | null>;
  }

  async getDeliveryZoneInfo(id: string) {
    const doc = await this.restaurantModel
      .findById(id, 'boundType deliveryBounds location address city postCode')
      .lean()
      .exec();
    if (!doc) throw new NotFoundException(`Restaurant ${id} not found`);
    return doc;
  }
}
