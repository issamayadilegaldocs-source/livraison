import { Field, Float, ObjectType } from '@nestjs/graphql';

@ObjectType('GeoPoint')
export class GeoPointModel {
  @Field(() => [Float], { nullable: true })
  coordinates?: number[];
}

@ObjectType('GeoPolygon')
export class GeoPolygonModel {
  @Field(() => [[[Float]]])
  coordinates!: number[][][];
}

@ObjectType('CircleBounds')
export class CircleBoundsModel {
  @Field(() => Float)
  radius!: number;
}
