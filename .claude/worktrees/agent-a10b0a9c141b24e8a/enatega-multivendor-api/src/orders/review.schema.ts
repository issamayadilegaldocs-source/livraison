import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ReviewDocument = HydratedDocument<Review>;

@Schema({ collection: 'reviews', timestamps: true })
export class Review {
  @Prop({ type: Types.ObjectId, ref: 'Order' }) order?: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Restaurant' }) restaurant?: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User' }) user?: Types.ObjectId;
  @Prop() rating?: number;
  // `description` is the active review body written by reviewOrder. `comments` is a
  // legacy field retained only for backward compatibility with clients that still
  // read it; new reviews never populate it. Prefer `description`.
  @Prop() comments?: string;
  @Prop() description?: string;
  @Prop({ default: true }) isActive?: boolean;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);
// Matches order-stats.service.ts#reviewsByRestaurant's
// find({ restaurant, isActive: true }) — run on every restaurant detail
// page load and on the `reviewData` field resolver. The collection had no
// indexes at all before this, so every review fetch was a full scan.
ReviewSchema.index({ restaurant: 1, isActive: 1 });
