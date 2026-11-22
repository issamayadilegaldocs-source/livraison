import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WalletTopUpDocument = WalletTopUp & Document;

@Schema({ timestamps: true })
export class WalletTopUp {
  /** Client-controlled UUID embedded in the Flouci success/fail callback URL. */
  @Prop({ required: true, index: true, unique: true })
  sessionId: string;

  /** Flouci-assigned payment ID, stored after generatePayment and used for verifyPayment. */
  @Prop({ required: true })
  paymentId: string;

  @Prop({ required: true, index: true })
  userId: string;

  /** Amount in TND (not millimes). */
  @Prop({ required: true })
  amount: number;

  @Prop()
  amountMinor?: number;

  @Prop({ default: 'TND' })
  amountCurrency?: string;

  @Prop({ default: 3 })
  amountScale?: number;

  @Prop({ enum: ['PENDING', 'COMPLETED', 'FAILED'], default: 'PENDING' })
  status: string;
}

export const WalletTopUpSchema = SchemaFactory.createForClass(WalletTopUp);
