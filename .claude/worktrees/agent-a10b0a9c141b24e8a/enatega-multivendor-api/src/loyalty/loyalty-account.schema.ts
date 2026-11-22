import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type LoyaltyAccountDocument = HydratedDocument<LoyaltyAccount>;

@Schema({ collection: 'loyalty_accounts', timestamps: true })
export class LoyaltyAccount {
  @Prop({ required: true, index: true, unique: true }) userId!: string;
  @Prop({ default: 0 }) points!: number;
  @Prop({ default: 0 }) lifetimePoints!: number;
}

export const LoyaltyAccountSchema = SchemaFactory.createForClass(LoyaltyAccount);
