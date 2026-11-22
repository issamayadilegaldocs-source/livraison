import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CategoryDocument = HydratedDocument<Category>;

/**
 * Catalog category, extracted out of the embedded `restaurant.categories`
 * array into its own collection (slice 4b). Owned exclusively by the Catalog
 * capability; the only link back to its restaurant is the indexed
 * `restaurantId`.
 */
@Schema({ collection: 'categories', timestamps: true })
export class Category {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  restaurantId!: Types.ObjectId;

  @Prop({ required: true }) title!: string;
  @Prop() image?: string;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
