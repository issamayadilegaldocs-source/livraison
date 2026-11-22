import { Type } from 'class-transformer';
import { IsDate, IsNumber, Max, Min } from 'class-validator';
import { Field, Float, GraphQLISODateTime, InputType } from '@nestjs/graphql';

/**
 * Lightweight intermediate trail point sent in a batch alongside the freshest
 * live location (see updateOrderRiderLocation `bufferedPoints`). Only the
 * fields needed to reconstruct the route are accepted — the live broadcast,
 * geofence, and CAS dedup still operate on the single freshest point.
 */
@InputType('TrailPointInput')
export class TrailPointInput {
  @Field(() => Float)
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(-90)
  @Max(90)
  latitude!: number;

  @Field(() => Float)
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(-180)
  @Max(180)
  longitude!: number;

  @Field(() => GraphQLISODateTime)
  @Type(() => Date)
  @IsDate()
  capturedAt!: Date;
}
