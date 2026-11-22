import { Field, Float, ID, ObjectType } from '@nestjs/graphql';
import { GeoPolygonModel } from '../common/models/geo.model';

@ObjectType('Zone')
export class ZoneModel {
  @Field(() => ID)
  _id!: string;

  @Field()
  title!: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => GeoPolygonModel, { nullable: true })
  location?: GeoPolygonModel;

  @Field(() => Float, { nullable: true })
  tax?: number;

  @Field({ nullable: true })
  isActive?: boolean;
}
