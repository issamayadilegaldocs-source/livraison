import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SupportTicketDocument = HydratedDocument<SupportTicket>;

@Schema({ collection: 'support_tickets', timestamps: true })
export class SupportTicket {
  @Prop({ required: true }) title!: string;
  @Prop({ required: true }) description!: string;
  @Prop({ default: 'open' }) status!: string;
  @Prop({ required: true }) category!: string;
  @Prop() orderId?: string;
  @Prop() otherDetails?: string;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) user!: Types.ObjectId;
}

export const SupportTicketSchema = SchemaFactory.createForClass(SupportTicket);
