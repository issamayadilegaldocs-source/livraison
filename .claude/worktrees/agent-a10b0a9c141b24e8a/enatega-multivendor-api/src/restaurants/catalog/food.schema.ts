import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type FoodDocument = HydratedDocument<Food>;

/**
 * Variation stays embedded in Food — variations are always loaded, edited and
 * priced together with their food and are never queried independently, so they
 * are a value-object collection inside the Food aggregate rather than their own
 * collection.
 */
@Schema({ _id: true })
export class Variation {
  @Prop({ type: Types.ObjectId, default: () => new Types.ObjectId() })
  _id?: Types.ObjectId;

  @Prop() title?: string;
  @Prop({ default: 0 }) price?: number;
  @Prop() priceMinor?: number;
  @Prop({ default: 0 }) discounted?: number;
  @Prop() discountedMinor?: number;
  @Prop({ type: [String], default: [] }) addons?: string[];
  @Prop({ default: false }) isOutOfStock?: boolean;
}

const VariationSchema = SchemaFactory.createForClass(Variation);

/**
 * Catalog food, extracted out of the embedded `restaurant.categories[].foods`
 * array (slice 4b). Linked to its restaurant and category by indexed ids;
 * `subCategory` is indexed so sub-category usage counts are a direct query.
 */
@Schema({ collection: 'foods', timestamps: true })
export class Food {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  restaurantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  categoryId!: Types.ObjectId;

  @Prop({ required: true }) title!: string;
  @Prop() description?: string;
  @Prop() image?: string;
  @Prop({ index: true }) subCategory?: string;
  @Prop({ default: true }) isActive?: boolean;
  @Prop({ default: false }) isOutOfStock?: boolean;
  @Prop({ type: [VariationSchema], default: [] }) variations?: Variation[];
}

export const FoodSchema = SchemaFactory.createForClass(Food);
