import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { ConfigService } from '@nestjs/config';

export interface ScalewaySmsRequest {
  phoneNumber: string;
  message: string;
}

export interface ScalewaySmsResponse {
  total_count: number;
  messages: Array<{
    id: string;
    to: string;
    status: string;
  }>;
}

@Injectable()
export class ScalewaySmsProvider {
  private readonly logger = new Logger(ScalewaySmsProvider.name);
  private client: AxiosInstance;
  private apiKey: string;
  private projectId: string;
  private serviceId: string;
  private defaultSender: string;
  private enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    this.loadConfig();
  }

  private loadConfig() {
    this.apiKey = this.configService.get<string>('SCALEWAY_SMS_API_KEY') || '';
    this.projectId = this.configService.get<string>('SCALEWAY_SMS_PROJECT_ID') || '';
    this.serviceId = this.configService.get<string>('SCALEWAY_SMS_SERVICE_ID') || '';
    this.defaultSender = this.configService.get<string>('SCALEWAY_SMS_SENDER') || 'Enatega';
    this.enabled = this.apiKey && this.projectId && this.serviceId ? true : false;

    if (!this.enabled) {
      this.logger.warn('Scaleway SMS is not configured. SMS sending will be disabled.');
    }

    this.client = axios.create({
      baseURL: 'https://api.scaleway.com/sms/v1',
      headers: {
        'X-Auth-Token': this.apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async sendSms(request: ScalewaySmsRequest): Promise<ScalewaySmsResponse | null> {
    if (!this.enabled) {
      this.logger.warn('Scaleway SMS is not enabled. SMS not sent.');
      return null;
    }

    try {
      const response = await this.client.post(
        `/projects/${this.projectId}/messages/send`,
        {
          messages: [
            {
              to: request.phoneNumber,
              content: request.message,
              type: 'transactional',
              sender: this.defaultSender,
            },
          ],
        },
      );

      this.logger.debug(`SMS sent successfully to ${request.phoneNumber}`);
      return response.data;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to send SMS: ${err.message}`, err.stack);
      throw err;
    }
  }

  getDefaultSender(): string {
    return this.defaultSender;
  }
}
