import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { ConfigService } from '@nestjs/config';

export interface ScalewayEmailSendRequest {
  from: {
    name: string;
    email: string;
  };
  to: Array<{
    email: string;
    name?: string;
  }>;
  cc?: Array<{
    email: string;
    name?: string;
  }>;
  bcc?: Array<{
    email: string;
    name?: string;
  }>;
  subject: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
}

export interface ScalewayEmailSendResponse {
  messages: Array<{
    id: string;
    to: string;
    status: string;
  }>;
}

@Injectable()
export class ScalewayEmailProvider {
  private readonly logger = new Logger(ScalewayEmailProvider.name);
  private client: AxiosInstance;
  private apiKey: string;
  private projectId: string;
  private sendingDomain: string;
  private fromName: string;
  private enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    this.loadConfig();
  }

  private loadConfig() {
    this.apiKey = this.configService.get<string>('SCALEWAY_EMAIL_API_KEY') || '';
    this.projectId = this.configService.get<string>('SCALEWAY_EMAIL_PROJECT_ID') || '';
    this.sendingDomain = this.configService.get<string>('SCALEWAY_EMAIL_DOMAIN') || 'notification@enatega.com';
    this.fromName = this.configService.get<string>('SCALEWAY_EMAIL_FROM_NAME') || 'Enatega';
    this.enabled = this.apiKey && this.projectId ? true : false;

    if (!this.enabled) {
      this.logger.warn('Scaleway Email is not configured. Email sending will be disabled.');
    }

    this.client = axios.create({
      baseURL: `https://api.scaleway.com/transactional-email/v1alpha1/namespaces/${this.projectId}`,
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

  async sendEmail(request: ScalewayEmailSendRequest): Promise<ScalewayEmailSendResponse | null> {
    if (!this.enabled) {
      this.logger.warn('Scaleway Email is not enabled. Email not sent.');
      return null;
    }

    try {
      const response = await this.client.post('/emails', {
        from: {
          name: request.from.name || this.fromName,
          email: request.from.email || this.sendingDomain,
        },
        to: request.to,
        cc: request.cc,
        bcc: request.bcc,
        subject: request.subject,
        text: request.text,
        html: request.html,
        headers: request.headers || {},
      });

      this.logger.debug(`Email sent successfully to ${request.to.map((r) => r.email).join(', ')}`);
      return response.data;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to send email: ${err.message}`, err.stack);
      throw err;
    }
  }

  getSendingDomain(): string {
    return this.sendingDomain;
  }

  getFromName(): string {
    return this.fromName;
  }
}
