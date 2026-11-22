import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class GoogleRoutesProvider {
  private readonly logger = new Logger(GoogleRoutesProvider.name);
  private readonly client: AxiosInstance = axios.create({ timeout: 2500 });

  constructor(private readonly configService: ConfigService) {}

  async travelMinutes(origin: [number, number], destination: [number, number]): Promise<number | null> {
    const apiKey = this.configService.get<string>('GOOGLE_ROUTES_API_KEY');
    if (!apiKey) {
      this.diagnostic('missing_api_key');
      return null;
    }

    try {
      const response = await this.client.post(
        'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix',
        {
          origins: [{ waypoint: { location: { latLng: { latitude: origin[1], longitude: origin[0] } } } }],
          destinations: [{ waypoint: { location: { latLng: { latitude: destination[1], longitude: destination[0] } } } }],
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_AWARE',
        },
        {
          headers: {
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'originIndex,destinationIndex,duration,condition',
          },
          validateStatus: () => true,
        },
      );

      if (response.status < 200 || response.status >= 300) {
        this.diagnostic('http_error', { status: response.status });
        return null;
      }
      const element = Array.isArray(response.data) ? response.data[0] : null;
      if (!element) {
        this.diagnostic('empty_response');
        return null;
      }
      if (element.condition !== 'ROUTE_EXISTS') {
        this.diagnostic('invalid_route', { condition: element.condition });
        return null;
      }
      const match = typeof element.duration === 'string' && element.duration.match(/^([0-9]+(?:\.[0-9]+)?)s$/);
      const seconds = match ? Number(match[1]) : NaN;
      if (!Number.isFinite(seconds) || seconds <= 0) {
        this.diagnostic('invalid_duration');
        return null;
      }
      return Math.ceil(seconds / 60);
    } catch (error: any) {
      this.diagnostic('request_failed', { code: error?.code });
      return null;
    }
  }

  private diagnostic(reason: string, details: Record<string, unknown> = {}): void {
    this.logger.warn(JSON.stringify({ provider: 'google-routes', reason, ...details }));
  }
}
