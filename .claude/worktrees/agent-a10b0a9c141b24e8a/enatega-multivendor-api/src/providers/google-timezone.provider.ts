import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

/**
 * Resolves an IANA timezone id from coordinates via the Google Time Zone API,
 * mirroring `GoogleRoutesProvider`'s axios/config/log shape. Failure (no key /
 * HTTP error / bad payload) returns null — the caller leaves `timezone` unset
 * and the evaluator falls back to the configured default. Never blocks
 * restaurant create/edit.
 */
@Injectable()
export class GoogleTimezoneProvider {
  private readonly logger = new Logger(GoogleTimezoneProvider.name);
  private readonly client: AxiosInstance = axios.create({ timeout: 2500 });

  constructor(private readonly configService: ConfigService) {}

  /** `coordinates` is `[lng, lat]` (GeoJSON order), matching stored locations. */
  async timezoneFor(coordinates: [number, number]): Promise<string | null> {
    // The Time Zone API needs a Maps-Platform key; reuse the routes key only if
    // it has the Time Zone API enabled.
    const apiKey =
      this.configService.get<string>('GOOGLE_MAPS_API_KEY') ??
      this.configService.get<string>('GOOGLE_ROUTES_API_KEY');
    if (!apiKey) {
      this.diagnostic('missing_api_key');
      return null;
    }

    const [lng, lat] = coordinates;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      this.diagnostic('invalid_coordinates');
      return null;
    }

    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const response = await this.client.get('https://maps.googleapis.com/maps/api/timezone/json', {
        params: { location: `${lat},${lng}`, timestamp, key: apiKey },
        validateStatus: () => true,
      });

      if (response.status < 200 || response.status >= 300) {
        this.diagnostic('http_error', { status: response.status });
        return null;
      }
      const { status, timeZoneId } = response.data ?? {};
      if (status !== 'OK' || typeof timeZoneId !== 'string' || !timeZoneId) {
        this.diagnostic('invalid_response', { status });
        return null;
      }
      return timeZoneId;
    } catch (error: any) {
      this.diagnostic('request_failed', { code: error?.code });
      return null;
    }
  }

  private diagnostic(reason: string, details: Record<string, unknown> = {}): void {
    this.logger.warn(JSON.stringify({ provider: 'google-timezone', reason, ...details }));
  }
}
