import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type NotificationDocument = HydratedDocument<Notification>;

@Schema({ collection: 'notifications', timestamps: true })
export class Notification {
  @Prop({ required: true }) title!: string;
  @Prop({ required: true }) body!: string;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
