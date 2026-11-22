import { Field, Float, GraphQLISODateTime, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('RiderLocation')
export class RiderLocationModel {
  @Field(() => ID) orderId!: string;
  @Field(() => Float) latitude!: number;
  @Field(() => Float) longitude!: number;
  @Field(() => Float, { nullable: true }) accuracyMeters?: number;
  @Field(() => Float, { nullable: true }) headingDegrees?: number;
  @Field(() => Float, { nullable: true }) speedMetersPerSecond?: number;
  @Field(() => GraphQLISODateTime) capturedAt!: Date;
  @Field(() => GraphQLISODateTime) receivedAt!: Date;
  @Field(() => ID) updateId!: string;
}

@ObjectType('TrackingSession')
export class TrackingSessionModel {
  @Field() token!: string;
  @Field(() => GraphQLISODateTime) expiresAt!: Date;
}

/** Fleet-wide (not per-order) rider presence update for the admin ops map's
 * live subscription. Throttled at the publish site — see writePresence. */
@ObjectType('FleetRiderLocation')
export class FleetRiderLocationModel {
  @Field(() => ID) riderId!: string;
  @Field(() => Float) latitude!: number;
  @Field(() => Float) longitude!: number;
  @Field(() => GraphQLISODateTime) capturedAt!: Date;
}
