import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type WebNotificationDocument = HydratedDocument<WebNotification>;

@Schema({ collection: 'webnotifications', timestamps: true })
export class WebNotification {
  @Prop({ required: true }) body!: string;
  @Prop() navigateTo?: string;
  @Prop({ default: false }) read?: boolean;
}

export const WebNotificationSchema = SchemaFactory.createForClass(WebNotification);
