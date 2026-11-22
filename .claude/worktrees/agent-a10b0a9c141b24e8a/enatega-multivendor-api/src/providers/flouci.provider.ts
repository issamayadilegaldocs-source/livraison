import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface FlouciGenerateParams {
  amountMillimes: number;
  successLink: string;
  failLink: string;
  trackingId?: string;
  sessionTimeoutSecs?: number;
  acceptCard?: boolean;
}

export interface FlouciGenerateResult {
  link: string;
  paymentId: string;
  raw?: Record<string, unknown>;
}

export type FlouciStatus = 'SUCCESS' | 'FAILURE' | 'PENDING';

export interface FlouciVerifyResult {
  status: FlouciStatus;
  raw?: Record<string, unknown>;
}

/**
 * Thin wrapper over the Flouci developer payment API — the Tunisian gateway
 * (local cards, e-DINAR, Flouci wallet). Amounts are in **millimes** (TND * 1000).
 * Credentials come from env (`FLOUCI_APP_TOKEN` / `FLOUCI_APP_SECRET`); this file
 * is the single place the exact endpoint/field names live (see docs.flouci.com),
 * so swapping or sandbox-testing the gateway never touches business code.
 */
@Injectable()
export class FlouciProvider {
  private readonly logger = new Logger(FlouciProvider.name);
  private readonly client: AxiosInstance = axios.create({ timeout: 10_000 });

  constructor(private readonly configService: ConfigService) {}

  get isConfigured(): boolean {
    return Boolean(
      this.configService.get<string>('FLOUCI_APP_TOKEN') &&
        this.configService.get<string>('FLOUCI_APP_SECRET'),
    );
  }

  private baseUrl(): string {
    return this.configService
      .get<string>('FLOUCI_BASE_URL', 'https://developers.flouci.com/api')
      .replace(/\/$/, '');
  }

  async generatePayment(params: FlouciGenerateParams): Promise<FlouciGenerateResult> {
    const appToken = this.configService.getOrThrow<string>('FLOUCI_APP_TOKEN');
    const appSecret = this.configService.getOrThrow<string>('FLOUCI_APP_SECRET');

    const body = {
      app_token: appToken,
      app_secret: appSecret,
      amount: String(Math.max(0, Math.round(params.amountMillimes))),
      accept_card: String(params.acceptCard ?? true),
      session_timeout_secs: params.sessionTimeoutSecs ?? 1200,
      success_link: params.successLink,
      fail_link: params.failLink,
      developer_tracking_id: params.trackingId ?? '',
    };

    const response = await this.client.post(`${this.baseUrl()}/generate_payment`, body, {
      validateStatus: () => true,
    });

    const result = response.data?.result;
    if (response.status < 200 || response.status >= 300 || !result?.link) {
      this.diagnostic('generate_failed', { status: response.status });
      throw new Error('Flouci generate_payment failed');
    }
    return { link: result.link, paymentId: result.payment_id ?? result.paymentId, raw: response.data };
  }

  async verifyPayment(paymentId: string): Promise<FlouciStatus> {
    return (await this.verifyPaymentResult(paymentId)).status;
  }

  async verifyPaymentResult(paymentId: string): Promise<FlouciVerifyResult> {
    const appToken = this.configService.getOrThrow<string>('FLOUCI_APP_TOKEN');
    const appSecret = this.configService.getOrThrow<string>('FLOUCI_APP_SECRET');

    const response = await this.client.get(`${this.baseUrl()}/verify_payment/${paymentId}`, {
      headers: { apppublic: appToken, appsecret: appSecret },
      validateStatus: () => true,
    });

    if (response.status < 200 || response.status >= 300) {
      this.diagnostic('verify_http_error', { status: response.status });
      return { status: 'PENDING', raw: response.data };
    }
    const status = String(
      response.data?.result?.status ?? response.data?.status ?? '',
    ).toUpperCase();
    if (status === 'SUCCESS') return { status: 'SUCCESS', raw: response.data };
    if (status === 'FAILURE' || status === 'FAILED') return { status: 'FAILURE', raw: response.data };
    return { status: 'PENDING', raw: response.data };
  }

  private diagnostic(reason: string, details: Record<string, unknown> = {}): void {
    this.logger.warn(JSON.stringify({ provider: 'flouci', reason, ...details }));
  }
}
