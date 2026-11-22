import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OptionDocument = HydratedDocument<Option>;

/**
 * Catalog option, extracted out of the embedded `restaurant.options` array
 * (slice 4b). Referenced by id from `addon.options`.
 */
@Schema({ collection: 'options', timestamps: true })
export class Option {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  restaurantId!: Types.ObjectId;

  @Prop({ required: true }) title!: string;
  @Prop() description?: string;
  @Prop({ default: 0 }) price?: number;
  @Prop() priceMinor?: number;
}

export const OptionSchema = SchemaFactory.createForClass(Option);
