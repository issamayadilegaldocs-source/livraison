import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AddonDocument = HydratedDocument<Addon>;

/**
 * Catalog addon, extracted out of the embedded `restaurant.addons` array
 * (slice 4b). `options` stays a string array of Option ids, referenced from
 * `variation.addons`.
 */
@Schema({ collection: 'addons', timestamps: true })
export class Addon {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  restaurantId!: Types.ObjectId;

  @Prop({ required: true }) title!: string;
  @Prop() description?: string;
  @Prop({ default: 0 }) quantityMinimum?: number;
  @Prop({ default: 1 }) quantityMaximum?: number;
  @Prop({ type: [String], default: [] }) options?: string[];
}

export const AddonSchema = SchemaFactory.createForClass(Addon);
