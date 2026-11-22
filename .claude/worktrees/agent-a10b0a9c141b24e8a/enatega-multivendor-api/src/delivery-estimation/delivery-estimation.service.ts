import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Configuration, ConfigurationDocument } from '../configuration/configuration.schema';
import { GoogleRoutesProvider } from '../providers/google-routes.provider';
import { Restaurant, RestaurantDocument } from '../restaurants/restaurant.schema';
import { DeliveryTimeEstimationMode } from './dto/delivery-time-estimation-mode.enum';
import { DeliveryTimeEstimate } from './delivery-estimation.model';

type EstimateInput = { restaurantId: string; latitude: number; longitude: number; isPickedUp: boolean };
/**
 * `useProvider: false` resolves the travel time from cache only — it never makes
 * an outbound routing call. Order placement uses this so it can never be slowed
 * by Google: it reuses the value the checkout screen already warmed, and falls
 * back to the static prep time instantly on a cache miss.
 */
type EstimateOptions = { useProvider?: boolean };
type CacheEntry = { minutes: number; expiresAt: number };

@Injectable()
export class DeliveryEstimationService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<number | null>>();
  private readonly cacheTtlMs = 5 * 60_000;
  private readonly maxCacheEntries = 500;

  constructor(
    @InjectModel(Restaurant.name) private readonly restaurantModel: Model<RestaurantDocument>,
    @InjectModel(Configuration.name) private readonly configurationModel: Model<ConfigurationDocument>,
    private readonly routesProvider: GoogleRoutesProvider,
  ) {}

  async estimate(input: EstimateInput, options: EstimateOptions = {}): Promise<DeliveryTimeEstimate> {
    const useProvider = options.useProvider !== false;
    const restaurant = await this.restaurantModel.findById(input.restaurantId).lean().exec();
    const prepMinutes = this.normalizeMinutes((restaurant as any)?.deliveryTime);
    const fallback: DeliveryTimeEstimate = { totalMinutes: prepMinutes, travelMinutes: 0, prepMinutes, source: 'static' };
    if (!restaurant || input.isPickedUp) return fallback;

    const configuration = await this.configurationModel.findOne().lean().exec();
    if ((configuration as any)?.deliveryTimeEstimationMode !== DeliveryTimeEstimationMode.DYNAMIC) return fallback;

    const origin = (restaurant as any).location?.coordinates;
    if (!this.validCoordinates(origin?.[1], origin?.[0]) || !this.validCoordinates(input.latitude, input.longitude)) return fallback;

    const key = `${input.restaurantId}:${input.latitude.toFixed(3)}:${input.longitude.toFixed(3)}`;
    const travelMinutes = useProvider
      ? await this.getTravelMinutes(key, [origin[0], origin[1]], [input.longitude, input.latitude])
      : this.readCache(key);
    if (travelMinutes === null) return fallback;
    return { totalMinutes: prepMinutes + travelMinutes, travelMinutes, prepMinutes, source: 'dynamic' };
  }

  private readCache(key: string): number | null {
    this.sweepExpired();
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      this.cache.delete(key);
      this.cache.set(key, cached); // LRU touch
      return cached.minutes;
    }
    return null;
  }

  private async getTravelMinutes(key: string, origin: [number, number], destination: [number, number]): Promise<number | null> {
    const cached = this.readCache(key);
    if (cached !== null) return cached;
    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const request = this.routesProvider.travelMinutes(origin, destination)
      .then((minutes) => {
        if (minutes !== null) this.putCache(key, minutes);
        return minutes;
      })
      .catch(() => null)
      .finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, request);
    return request;
  }

  private putCache(key: string, minutes: number): void {
    while (this.cache.size >= this.maxCacheEntries) this.cache.delete(this.cache.keys().next().value as string);
    // This cache is deliberately per API process; replicas do not share entries.
    this.cache.set(key, { minutes, expiresAt: Date.now() + this.cacheTtlMs });
  }

  private sweepExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) if (entry.expiresAt <= now) this.cache.delete(key);
  }

  private normalizeMinutes(value: unknown): number {
    const minutes = Number(value);
    return Number.isFinite(minutes) && minutes >= 0 ? Math.floor(minutes) : 0;
  }

  private validCoordinates(latitude: unknown, longitude: unknown): boolean {
    return typeof latitude === 'number' && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
      typeof longitude === 'number' && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
  }
}
