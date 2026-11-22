import { Field, Float, GraphQLISODateTime, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('OrderTrailPoint')
export class OrderTrailPointModel {
  @Field(() => Float) latitude!: number;
  @Field(() => Float) longitude!: number;
  @Field(() => GraphQLISODateTime) capturedAt!: Date;
}

@ObjectType('OrderTrail')
export class OrderTrailModel {
  @Field(() => ID) orderId!: string;
  @Field(() => ID, { nullable: true }) riderId?: string;
  @Field(() => [OrderTrailPointModel]) points!: OrderTrailPointModel[];
}
