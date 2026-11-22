import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PushDeliveryResult } from './push-delivery-result';

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  priority: 'default' | 'normal' | 'high';
  channelId: string;
  data: Record<string, string>;
}

interface ExpoPushTicket {
  status?: string;
  id?: string;
  message?: string;
  details?: {
    error?: string;
  };
}

const PERMANENT_EXPO_TOKEN_ERRORS = new Set(['DeviceNotRegistered']);

@Injectable()
export class ExpoPushProvider {
  private readonly logger = new Logger(ExpoPushProvider.name);

  async send(message: ExpoPushMessage): Promise<PushDeliveryResult> {
    try {
      const response = await axios.post('https://exp.host/--/api/v2/push/send', message, {
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        timeout: 8000,
      });
      return this.toDeliveryResult(message.to, this.extractTicket(response.data));
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.warn(`Expo push failed: ${err.message}`);
      return {
        provider: 'expo',
        token: message.to,
        accepted: false,
        permanentFailure: false,
        message: err.message,
      };
    }
  }

  /**
   * Send many messages in Expo's batch format (up to 100 per HTTP request,
   * Expo's own documented limit) instead of one HTTP request per message.
   * A zone-wide dispatch broadcast to N riders previously fired N
   * concurrent axios requests (sendNearbyOrderPushes used
   * Promise.all(targets.map(send))) — at a few hundred riders that's a
   * few hundred simultaneous connections to Expo's push endpoint with no
   * batching, risking connection-pool exhaustion and Expo-side rate
   * limiting. Order of the returned results matches the input order.
   */
  async sendBatch(messages: ExpoPushMessage[]): Promise<PushDeliveryResult[]> {
    if (messages.length === 0) return [];

    const chunks: ExpoPushMessage[][] = [];
    for (let i = 0; i < messages.length; i += 100) {
      chunks.push(messages.slice(i, i + 100));
    }

    const results: PushDeliveryResult[] = [];
    for (const chunk of chunks) {
      try {
        const response = await axios.post('https://exp.host/--/api/v2/push/send', chunk, {
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          timeout: 8000,
        });
        const tickets = this.extractTickets(response.data, chunk.length);
        chunk.forEach((message, i) => {
          results.push(this.toDeliveryResult(message.to, tickets[i]));
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(`Expo push batch failed (${chunk.length} messages): ${err.message}`);
        // Request-level failure (not per-message) — mark every message in
        // this chunk as a non-permanent failure so hygiene never wrongly
        // quarantines a token over an Expo-side outage.
        chunk.forEach((message) =>
          results.push({
            provider: 'expo',
            token: message.to,
            accepted: false,
            permanentFailure: false,
            message: err.message,
          }),
        );
      }
    }

    return results;
  }

  private extractTickets(payload: unknown, expectedCount: number): (ExpoPushTicket | undefined)[] {
    if (!payload || typeof payload !== 'object' || !('data' in payload)) {
      return new Array(expectedCount).fill(undefined);
    }
    const data = (payload as { data?: unknown }).data;
    return Array.isArray(data) ? (data as ExpoPushTicket[]) : new Array(expectedCount).fill(undefined);
  }

  private extractTicket(payload: unknown): ExpoPushTicket | undefined {
    if (!payload || typeof payload !== 'object' || !('data' in payload)) {
      return undefined;
    }

    const data = (payload as { data?: unknown }).data;
    if (Array.isArray(data)) {
      return data[0] as ExpoPushTicket | undefined;
    }
    return data as ExpoPushTicket | undefined;
  }

  private toDeliveryResult(token: string, ticket: ExpoPushTicket | undefined): PushDeliveryResult {
    if (ticket?.status === 'ok') {
      return {
        provider: 'expo',
        token,
        accepted: true,
        permanentFailure: false,
        ticketId: ticket.id,
        raw: ticket,
      };
    }

    const errorCode = ticket?.details?.error;
    const permanentFailure = errorCode ? PERMANENT_EXPO_TOKEN_ERRORS.has(errorCode) : false;
    const message = ticket?.message ?? 'Expo push ticket did not report success';

    this.logger.warn(
      `Expo push rejected token=${token} error=${errorCode ?? 'unknown'} permanent=${permanentFailure}: ${message}`,
    );

    return {
      provider: 'expo',
      token,
      accepted: false,
      permanentFailure,
      errorCode,
      message,
      raw: ticket,
    };
  }
}
