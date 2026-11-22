import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaymentAttempt, PaymentAttemptDocument, PaymentAttemptStatus } from './payment-attempt.schema';
import { PaymentAttemptAuditPort, PaymentAttemptSnapshot } from './payment-attempts.port';

@Injectable()
export class PaymentAttemptsService implements PaymentAttemptAuditPort {
  constructor(
    @InjectModel(PaymentAttempt.name)
    private readonly attemptModel: Model<PaymentAttemptDocument>,
  ) {}

  async createPending(input: PaymentAttemptSnapshot): Promise<void> {
    await this.create(input, 'PENDING');
  }

  async recordSucceeded(input: PaymentAttemptSnapshot): Promise<void> {
    await this.create(input, 'SUCCEEDED');
  }

  async mark(
    provider: string,
    providerReference: string,
    status: PaymentAttemptStatus,
    raw?: Record<string, unknown>,
    error?: { errorCode: string; errorMessage: string },
  ): Promise<void> {
    const now = new Date();
    const finished = status === 'SUCCEEDED' || status === 'FAILED' || status === 'CANCELED';
    await this.attemptModel
      .updateOne(
        { provider, providerReference },
        {
          $set: {
            status,
            raw,
            ...(finished ? { finishedAt: now } : {}),
            ...(status === 'SUCCEEDED' ? { paidAt: now } : {}),
            ...(error ?? {}),
          },
        },
      )
      .exec();
  }

  private async create(
    input: PaymentAttemptSnapshot,
    status: PaymentAttemptStatus,
  ): Promise<void> {
    const now = new Date();
    const finished = status === 'SUCCEEDED' || status === 'FAILED' || status === 'CANCELED';
    await this.attemptModel
      .updateOne(
        { provider: input.provider, providerReference: input.providerReference },
        {
          $setOnInsert: {
            subjectType: input.subjectType,
            subjectId: input.subjectId,
            amountMinor: input.amountMinor,
            amountCurrency: input.amountCurrency,
            amountScale: input.amountScale,
            provider: input.provider,
            providerReference: input.providerReference,
            idempotencyKey: input.idempotencyKey,
            link: input.link,
            startedAt: now,
            status,
            raw: input.raw,
            ...(finished ? { finishedAt: now } : {}),
            ...(status === 'SUCCEEDED' ? { paidAt: now } : {}),
          },
        },
        { upsert: true },
      )
      .exec();
  }
}
