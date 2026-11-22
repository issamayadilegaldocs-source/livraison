import { Field, Float, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('ReviewOrderItem')
export class ReviewOrderItemModel {
  @Field({ nullable: true }) title?: string;
}

@ObjectType('ReviewOrderUser')
export class ReviewOrderUserModel {
  @Field(() => ID, { nullable: true }) _id?: string;
  @Field({ nullable: true }) name?: string;
  @Field({ nullable: true }) email?: string;
}

@ObjectType('ReviewOrder')
export class ReviewOrderModel {
  @Field(() => ID, { nullable: true }) _id?: string;
  @Field({ nullable: true }) orderId?: string;
  @Field(() => [ReviewOrderItemModel], { nullable: true }) items?: ReviewOrderItemModel[];
  @Field(() => ReviewOrderUserModel, { nullable: true }) user?: ReviewOrderUserModel;
}

@ObjectType('ReviewRestaurant')
export class ReviewRestaurantModel {
  @Field(() => ID, { nullable: true }) _id?: string;
  @Field({ nullable: true }) name?: string;
  @Field({ nullable: true }) image?: string;
}

@ObjectType('Review')
export class ReviewModel {
  @Field(() => ID, { nullable: true }) _id?: string;
  @Field(() => ReviewOrderModel, { nullable: true }) order?: ReviewOrderModel;
  @Field(() => ReviewRestaurantModel, { nullable: true }) restaurant?: ReviewRestaurantModel;
  @Field(() => Float, { nullable: true }) rating?: number;
  @Field({ nullable: true }) comments?: string;
  @Field({ nullable: true }) description?: string;
  @Field({ nullable: true }) createdAt?: string;
}
