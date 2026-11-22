import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ShopTypeDocument = HydratedDocument<ShopType>;

@Schema({ collection: 'shopTypes', timestamps: true })
export class ShopType {
  @Prop({ required: true }) name!: string;

  @Prop() image?: string;

  @Prop({ unique: true, sparse: true }) slug?: string;

  @Prop({ default: true }) isActive?: boolean;
}

export const ShopTypeSchema = SchemaFactory.createForClass(ShopType);
