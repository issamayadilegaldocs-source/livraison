import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TaxationDocument = HydratedDocument<Taxation>;

@Schema({ collection: 'taxations', timestamps: true })
export class Taxation {
  @Prop({ default: 0 }) taxationCharges!: number;
  @Prop({ default: true }) enabled!: boolean;
}

export const TaxationSchema = SchemaFactory.createForClass(Taxation);
