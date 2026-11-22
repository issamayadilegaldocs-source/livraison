import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';
import { PushDeliveryResult } from './push-delivery-result';

// FCM error codes that mean the token itself is dead (uninstalled app,
// token superseded by a newer one) rather than a transient send failure —
// mirrors PERMANENT_EXPO_TOKEN_ERRORS in expo-push.provider.ts so both
// providers feed the same hygiene cleanup consistently.
const PERMANENT_FCM_TOKEN_ERRORS = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

export interface FcmMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class FcmProvider implements OnModuleInit {
  private readonly logger = new Logger(FcmProvider.name);
  private messaging: Messaging | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.getPrivateKey();

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn('Firebase is not configured. Push notifications will be disabled.');
      return;
    }

    let app: App;
    if (getApps().length > 0) {
      app = getApps()[0]!;
    } else {
      app = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    }

    this.messaging = getMessaging(app);
    this.logger.log('Firebase Admin SDK initialized.');
  }

  isEnabled(): boolean {
    return this.messaging !== null;
  }

  async sendToToken(token: string, message: FcmMessage): Promise<boolean> {
    if (!this.messaging) return false;

    try {
      await this.messaging.send({
        token,
        notification: { title: message.title, body: message.body },
        data: message.data,
      });
      return true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.warn(`FCM send failed for token ${token.slice(0, 20)}…: ${err.message}`);
      return false;
    }
  }

  /**
   * Sends to every token in batches of 500 (FCM's multicast limit) and
   * returns a per-token result so callers can feed permanent failures
   * (uninstalled app, superseded token) into token-hygiene cleanup — a
   * dead customer token previously had no path back to cleanup at all
   * because this method only returned a count, not which tokens failed.
   */
  async sendToTokensDetailed(tokens: string[], message: FcmMessage): Promise<PushDeliveryResult[]> {
    if (!this.messaging || tokens.length === 0) return [];

    const chunks: string[][] = [];
    for (let i = 0; i < tokens.length; i += 500) {
      chunks.push(tokens.slice(i, i + 500));
    }

    const results: PushDeliveryResult[] = [];
    for (const chunk of chunks) {
      try {
        const response = await (this.messaging as any).sendEachForMulticast({
          tokens: chunk,
          notification: { title: message.title, body: message.body },
          data: message.data,
        });
        if (response.failureCount > 0) {
          this.logger.warn(`FCM multicast: ${response.failureCount} failures out of ${chunk.length}`);
        }
        response.responses.forEach((r: { success: boolean; error?: { code?: string; message?: string } }, i: number) => {
          const token = chunk[i];
          if (r.success) {
            results.push({ provider: 'fcm', token, accepted: true, permanentFailure: false });
            return;
          }
          const errorCode = r.error?.code;
          const permanentFailure = errorCode ? PERMANENT_FCM_TOKEN_ERRORS.has(errorCode) : false;
          if (permanentFailure) {
            this.logger.warn(
              `FCM token permanently failed token=${token.slice(0, 20)}… error=${errorCode}`,
            );
          }
          results.push({
            provider: 'fcm',
            token,
            accepted: false,
            permanentFailure,
            errorCode,
            message: r.error?.message,
          });
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.logger.error(`FCM multicast batch failed: ${err.message}`);
        // The whole chunk's outcome is unknown (request-level failure, not
        // per-token) — record as a non-permanent failure so hygiene never
        // wrongly quarantines a token over an outage.
        chunk.forEach((token) =>
          results.push({ provider: 'fcm', token, accepted: false, permanentFailure: false, message: err.message }),
        );
      }
    }

    return results;
  }

  /** @deprecated prefer sendToTokensDetailed, which surfaces per-token
   * failures for hygiene cleanup instead of only a count. */
  async sendToTokens(tokens: string[], message: FcmMessage): Promise<number> {
    const results = await this.sendToTokensDetailed(tokens, message);
    return results.filter((r) => r.accepted).length;
  }

  private getPrivateKey(): string | undefined {
    const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');
    if (privateKey) return privateKey.replace(/\\n/g, '\n');

    const encodedPrivateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY_BASE64');
    if (!encodedPrivateKey) return undefined;

    return Buffer.from(encodedPrivateKey, 'base64').toString('utf8');
  }
}
