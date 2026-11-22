import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CountryDocument = HydratedDocument<Country>;

@Schema({ _id: false })
export class City {
  @Prop({ required: true }) id!: string;
  @Prop({ required: true }) name!: string;
  @Prop() latitude?: number;
  @Prop() longitude?: number;
}

@Schema({ collection: 'countries', timestamps: true })
export class Country {
  @Prop({ required: true }) name!: string;
  @Prop() flag?: string;
  @Prop({ index: true }) iso?: string;
  @Prop({ type: [{ id: String, name: String, latitude: Number, longitude: Number, _id: false }], default: [] })
  cities!: City[];
}

export const CountrySchema = SchemaFactory.createForClass(Country);
