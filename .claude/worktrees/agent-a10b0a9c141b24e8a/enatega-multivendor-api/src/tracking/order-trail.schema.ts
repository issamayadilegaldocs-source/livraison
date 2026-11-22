import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OrderTrailDocument = HydratedDocument<OrderTrail>;

/** Retention window for route trails. They are privacy- and storage-sensitive, so
 * MongoDB auto-purges them this many days after creation via the TTL index below. */
export const ORDER_TRAIL_RETENTION_DAYS = 14;

/** Hard cap on stored points per order so a long/abnormal delivery cannot grow the
 * document without bound; we keep the most recent points. */
export const ORDER_TRAIL_MAX_POINTS = 5000;

@Schema({ _id: false })
export class TrailPoint {
  @Prop({ required: true }) latitude!: number;
  @Prop({ required: true }) longitude!: number;
  @Prop({ required: true }) capturedAt!: Date;
}

export const TrailPointSchema = SchemaFactory.createForClass(TrailPoint);

@Schema({ collection: 'order_trails', timestamps: true })
export class OrderTrail {
  @Prop({ type: Types.ObjectId, ref: 'Order', required: true, unique: true })
  order!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Rider' })
  rider?: Types.ObjectId;

  @Prop({ type: [TrailPointSchema], default: [] })
  points!: TrailPoint[];
}

export const OrderTrailSchema = SchemaFactory.createForClass(OrderTrail);

// Scheduled deletion: MongoDB removes each trail ORDER_TRAIL_RETENTION_DAYS after it
// was created (i.e. after the order it belongs to). No cron needed.
OrderTrailSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: ORDER_TRAIL_RETENTION_DAYS * 24 * 60 * 60 },
);
