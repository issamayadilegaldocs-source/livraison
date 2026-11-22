import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ActivityDocument = HydratedDocument<Activity>;

@Schema({ collection: 'activities', timestamps: true })
export class Activity {
  @Prop() userId?: string;
  @Prop({ required: true }) groupId!: string;
  @Prop({ required: true }) module!: string;
  @Prop({ required: true }) screenPath!: string;
  @Prop({ required: true }) type!: string;
  @Prop({ required: true }) details!: string;
}

export const ActivitySchema = SchemaFactory.createForClass(Activity);
