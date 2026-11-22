import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ZoneDocument = HydratedDocument<Zone>;

@Schema({ collection: 'zones', timestamps: true })
export class Zone {
  @Prop({ required: true }) title!: string;

  @Prop() description?: string;

  @Prop({
    type: {
      type: String,
      enum: ['Polygon'],
      default: 'Polygon',
    },
    coordinates: [[[Number]]],
  })
  location?: { type: string; coordinates: number[][][] };

  @Prop({ default: true }) isActive?: boolean;
}

export const ZoneSchema = SchemaFactory.createForClass(Zone);
ZoneSchema.index({ location: '2dsphere' });
