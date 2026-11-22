import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TicketMessageDocument = HydratedDocument<TicketMessage>;

@Schema({ collection: 'ticket_messages', timestamps: true })
export class TicketMessage {
  @Prop({ required: true }) content!: string;
  @Prop({ default: 'user' }) senderType!: string;
  @Prop({ default: false }) isRead!: boolean;
  @Prop({ type: Types.ObjectId, ref: 'SupportTicket', required: true }) ticket!: Types.ObjectId;
}

export const TicketMessageSchema = SchemaFactory.createForClass(TicketMessage);
