import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CustomerWalletDocument = HydratedDocument<CustomerWallet>;

/**
 * Prepaid balance for a customer. Funded by refunds (and, later, top-ups) and
 * spendable at checkout via the `WALLET` payment method. Identity is the Clerk
 * user id (`userId`), per the API identity rule — never the Mongo `_id`.
 */
@Schema({ collection: 'customer_wallets', timestamps: true })
export class CustomerWallet {
  @Prop({ required: true, unique: true, index: true }) userId!: string;
  @Prop({ default: 0 }) balanceMinor!: number;
  @Prop({ default: 0 }) balance!: number;
  @Prop() currency?: string;
}

export const CustomerWalletSchema = SchemaFactory.createForClass(CustomerWallet);

export type CustomerWalletTransactionDocument =
  HydratedDocument<CustomerWalletTransaction>;

/** Append-only ledger of wallet movements. */
@Schema({ collection: 'customer_wallet_transactions', timestamps: true })
export class CustomerWalletTransaction {
  @Prop({ required: true, index: true }) userId!: string;
  @Prop({ required: true }) type!: string; // CREDIT | DEBIT | REFUND
  @Prop({ required: true }) amountMinor!: number;
  @Prop({ required: true }) amount!: number;
  @Prop() balanceAfterMinor?: number;
  @Prop() balanceAfter?: number;
  @Prop({ type: Types.ObjectId, ref: 'Order' }) order?: Types.ObjectId;
  @Prop() reason?: string;
}

export const CustomerWalletTransactionSchema = SchemaFactory.createForClass(
  CustomerWalletTransaction,
);
