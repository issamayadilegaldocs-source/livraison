import { ConfigService } from '@nestjs/config';

export const TRACKING_CONFIG = 'TRACKING_CONFIG';

/**
 * Centralized, field-tunable tracking parameters (§7). Server-side defaults are
 * read once at startup through ConfigService so no feature code touches
 * process.env directly. Client cadence (distance, foreground/background/heartbeat
 * intervals, stale-after) is centralized per-app in each mobile tracking.config;
 * the customer staleness threshold is kept >= the rider heartbeat so an online
 * but stationary rider never flaps to "unavailable".
 */
export interface TrackingConfig {
  sessionTtlSeconds: number;
  locationTtlSeconds: number;
  presenceTtlSeconds: number;
  dispatchFallbackStaleSeconds: number;
  rateLimitMax: number;
  rateLimitWindowSeconds: number;
  futureToleranceMs: number;
}

const number = (config: ConfigService, key: string, fallback: number): number => {
  const raw = config.get<string>(key);
  if (raw === undefined || raw === null || raw === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const trackingConfigFactory = (config: ConfigService): TrackingConfig => {
  const presenceTtlSeconds = number(config, 'TRACKING_PRESENCE_TTL_SECONDS', 5 * 60);
  return {
    sessionTtlSeconds: number(config, 'TRACKING_SESSION_TTL_SECONDS', 12 * 60 * 60),
    locationTtlSeconds: number(config, 'TRACKING_LOCATION_TTL_SECONDS', 10 * 60),
    presenceTtlSeconds,
    dispatchFallbackStaleSeconds: number(
      config,
      'TRACKING_DISPATCH_FALLBACK_STALE_SECONDS',
      presenceTtlSeconds * 2,
    ),
    rateLimitMax: number(config, 'TRACKING_RATE_LIMIT_MAX', 30),
    rateLimitWindowSeconds: number(config, 'TRACKING_RATE_LIMIT_WINDOW_SECONDS', 60),
    futureToleranceMs: number(config, 'TRACKING_FUTURE_TOLERANCE_MS', 2 * 60_000),
  };
};
