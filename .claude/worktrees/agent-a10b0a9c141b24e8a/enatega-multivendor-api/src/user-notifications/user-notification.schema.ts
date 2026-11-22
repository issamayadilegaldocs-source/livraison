import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserNotificationDocument = HydratedDocument<UserNotification>;

@Schema({ collection: 'user_notifications', timestamps: true })
export class UserNotification {
  @Prop({ required: true, index: true }) userId!: string;
  @Prop({ required: true }) title!: string;
  @Prop({ required: true }) body!: string;
  @Prop({ default: 'SYSTEM' }) type!: string;
  @Prop({ type: Object }) data?: Record<string, string>;
  @Prop({ default: false }) isRead!: boolean;
}

export const UserNotificationSchema = SchemaFactory.createForClass(UserNotification);
