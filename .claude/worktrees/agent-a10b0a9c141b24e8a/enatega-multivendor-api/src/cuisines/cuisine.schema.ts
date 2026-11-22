import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CuisineDocument = HydratedDocument<Cuisine>;

@Schema({ collection: 'cuisines', timestamps: true })
export class Cuisine {
  @Prop({ required: true }) name!: string;

  @Prop() description?: string;

  @Prop() image?: string;

  @Prop() shopType?: string;
}

export const CuisineSchema = SchemaFactory.createForClass(Cuisine);
