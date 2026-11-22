import { Field, Float, GraphQLISODateTime, ID, ObjectType } from '@nestjs/graphql';

/** A route point tagged with which order it belongs to, so the frontend can
 * color/segment a rider's day-long route by delivery. */
@ObjectType('RiderDayTrailPoint')
export class RiderDayTrailPointModel {
  @Field(() => Float) latitude!: number;
  @Field(() => Float) longitude!: number;
  @Field(() => GraphQLISODateTime) capturedAt!: Date;
  @Field(() => ID) orderId!: string;
}

@ObjectType('RiderDayStop')
export class RiderDayStopModel {
  @Field(() => ID) orderId!: string;
  @Field({ nullable: true }) orderDisplayId?: string;
  @Field({ nullable: true }) restaurantName?: string;
  @Field({ nullable: true }) orderStatus?: string;
  @Field({ nullable: true }) assignedAt?: string;
  @Field({ nullable: true }) pickedAt?: string;
  @Field({ nullable: true }) deliveredAt?: string;
}

/** A rider's full day, reconstructed from their orders + each order's route
 * trail — for the admin "scrub through this rider's day" replay view. */
@ObjectType('RiderDayTrail')
export class RiderDayTrailModel {
  @Field(() => ID) riderId!: string;
  /** The calendar day requested, echoed back as YYYY-MM-DD (UTC). */
  @Field() date!: string;
  /** Chronologically ordered across all of the day's orders. */
  @Field(() => [RiderDayTrailPointModel]) points!: RiderDayTrailPointModel[];
  /** Orders/stops for the day, in chronological (assignedAt) order. */
  @Field(() => [RiderDayStopModel]) stops!: RiderDayStopModel[];
}
