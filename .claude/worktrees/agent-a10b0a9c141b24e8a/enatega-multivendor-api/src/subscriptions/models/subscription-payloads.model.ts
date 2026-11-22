import { Field, ID, ObjectType } from '@nestjs/graphql';
import { OrderModel } from '../../orders/order.model';

@ObjectType('OrderEventPayload')
export class OrderEventPayload {
  @Field({ nullable: true }) userId?: string;
  @Field({ nullable: true }) origin?: string;
  @Field(() => OrderModel, { nullable: true }) order?: OrderModel;
}

@ObjectType('ZoneOrderPayload')
export class ZoneOrderPayload {
  @Field({ nullable: true }) zoneId?: string;
  @Field({ nullable: true }) origin?: string;
  @Field(() => OrderModel, { nullable: true }) order?: OrderModel;
}

@ObjectType('RiderAssignedPayload')
export class RiderAssignedPayload {
  @Field({ nullable: true }) riderId?: string;
  @Field({ nullable: true }) origin?: string;
  @Field(() => OrderModel, { nullable: true }) order?: OrderModel;
}

@ObjectType('RiderUpdatedPayload')
export class RiderUpdatedPayload {
  @Field(() => ID) _id!: string;
}

@ObjectType('FoodStockChangedPayload')
export class FoodStockChangedPayload {
  @Field(() => ID) restaurantId!: string;
  @Field(() => ID) categoryId!: string;
  @Field(() => ID) foodId!: string;
  @Field() isOutOfStock!: boolean;
}
