import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type PaymentAttemptDocument = PaymentAttempt & Document;

export type PaymentAttemptSubjectType = 'ORDER' | 'WALLET_TOP_UP';
export type PaymentAttemptStatus = 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';

@Schema({ timestamps: true })
export class PaymentAttempt {
  @Prop({ required: true, enum: ['ORDER', 'WALLET_TOP_UP'], index: true })
  subjectType: PaymentAttemptSubjectType;

  @Prop({ required: true, index: true })
  subjectId: string;

  @Prop({ required: true })
  amountMinor: number;

  @Prop({ required: true, default: 'TND' })
  amountCurrency: string;

  @Prop({ required: true, default: 3 })
  amountScale: number;

  @Prop({ required: true, default: 'FLOUCI', index: true })
  provider: string;

  @Prop({ required: true, enum: ['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELED'], index: true })
  status: PaymentAttemptStatus;

  @Prop({ index: true })
  providerReference?: string;

  @Prop()
  idempotencyKey?: string;

  @Prop()
  link?: string;

  @Prop()
  startedAt?: Date;

  @Prop()
  finishedAt?: Date;

  @Prop()
  paidAt?: Date;

  @Prop()
  errorCode?: string;

  @Prop()
  errorMessage?: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  raw?: Record<string, unknown>;
}

export const PaymentAttemptSchema = SchemaFactory.createForClass(PaymentAttempt);

PaymentAttemptSchema.index(
  { provider: 1, providerReference: 1 },
  { unique: true, sparse: true },
);
