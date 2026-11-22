import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SubCategoryDocument = HydratedDocument<SubCategory>;

@Schema({ collection: 'subCategories', timestamps: true })
export class SubCategory {
  @Prop({ required: true }) title!: string;

  @Prop() parentCategoryId?: string;
}

export const SubCategorySchema = SchemaFactory.createForClass(SubCategory);
SubCategorySchema.index({ parentCategoryId: 1 });
