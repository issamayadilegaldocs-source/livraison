import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type WithdrawRequestDocument = HydratedDocument<WithdrawRequest>;

@Schema({ collection: 'withdrawrequests', timestamps: true })
export class WithdrawRequest {
  @Prop({ type: Types.ObjectId, ref: 'Rider' }) rider?: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Restaurant' }) restaurant?: Types.ObjectId;
  @Prop({ required: true }) requestAmount!: number;
  @Prop() requestAmountMinor?: number;
  @Prop() requestAmountCurrency?: string;
  @Prop() requestAmountScale?: number;
  @Prop({ default: 'PENDING', enum: ['PENDING', 'APPROVED', 'REJECTED', 'TRANSFERRED', 'CANCELLED', 'REQUESTED'] }) status?: string;
  @Prop() approvedAmount?: number;
  @Prop() approvedAmountMinor?: number;
  @Prop() reason?: string;
  @Prop() requestId?: string;
  @Prop() requestTime?: Date;
}

export const WithdrawRequestSchema = SchemaFactory.createForClass(WithdrawRequest);
