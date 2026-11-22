import { PaymentAttemptStatus, PaymentAttemptSubjectType } from './payment-attempt.schema';

export const PAYMENT_ATTEMPT_AUDIT_PORT = Symbol('PAYMENT_ATTEMPT_AUDIT_PORT');

export interface PaymentAttemptSnapshot {
  subjectType: PaymentAttemptSubjectType;
  subjectId: string;
  amountMinor: number;
  amountCurrency: string;
  amountScale: number;
  provider: string;
  providerReference: string;
  idempotencyKey: string;
  link?: string;
  raw?: Record<string, unknown>;
}

export interface PaymentAttemptAuditPort {
  createPending(input: PaymentAttemptSnapshot): Promise<void>;
  recordSucceeded(input: PaymentAttemptSnapshot): Promise<void>;
  mark(
    provider: string,
    providerReference: string,
    status: PaymentAttemptStatus,
    raw?: Record<string, unknown>,
    error?: { errorCode: string; errorMessage: string },
  ): Promise<void>;
}
