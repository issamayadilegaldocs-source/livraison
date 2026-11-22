import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type BannerDocument = HydratedDocument<Banner>;

@Schema({ collection: 'banners', timestamps: true })
export class Banner {
  @Prop({ required: true }) title!: string;

  @Prop() description?: string;

  @Prop() action?: string;

  @Prop() file?: string;

  @Prop() badgeText?: string;

  @Prop() buttonText?: string;

  @Prop() promoCode?: string;

  @Prop() backgroundColor?: string;

  @Prop() textColor?: string;

  @Prop() accentColor?: string;

  @Prop() buttonBackgroundColor?: string;

  @Prop() buttonTextColor?: string;

  @Prop({ default: 0 }) sortOrder?: number;

  @Prop({ default: true }) isActive?: boolean;

  @Prop() screen?: string;

  @Prop() parameters?: string;
}

export const BannerSchema = SchemaFactory.createForClass(Banner);
