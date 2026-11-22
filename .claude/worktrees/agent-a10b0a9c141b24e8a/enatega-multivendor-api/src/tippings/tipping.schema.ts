import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TippingDocument = HydratedDocument<Tipping>;

@Schema({ collection: 'tippings', timestamps: true })
export class Tipping {
  @Prop({ type: [Number], default: [] }) tipVariations!: number[];
  @Prop({ default: true }) enabled!: boolean;
}

export const TippingSchema = SchemaFactory.createForClass(Tipping);
