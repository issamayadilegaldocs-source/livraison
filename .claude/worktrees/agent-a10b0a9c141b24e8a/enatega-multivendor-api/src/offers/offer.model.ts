import { Field, Float, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('OfferRestaurant')
export class OfferRestaurantModel {
  @Field(() => ID) _id!: string;
  @Field({ nullable: true }) name?: string;
  @Field({ nullable: true }) image?: string;
  @Field({ nullable: true }) slug?: string;
}

@ObjectType('Offer')
export class OfferModel {
  @Field(() => ID) _id!: string;

  @Field(() => OfferRestaurantModel, { nullable: true })
  restaurant?: OfferRestaurantModel;

  @Field({ nullable: true }) title?: string;
  @Field() type!: string;
  @Field(() => Float) value!: number;

  @Field() startsAt!: Date;
  @Field() endsAt!: Date;

  @Field({ nullable: true }) scope?: string;
  @Field(() => [String], { nullable: true }) targetFoodIds?: string[];
  @Field(() => [String], { nullable: true }) targetCategoryIds?: string[];

  @Field(() => Float, { nullable: true }) minOrderAmount?: number;
  @Field(() => Float, { nullable: true }) maxDiscount?: number;

  @Field({ nullable: true }) enabled?: boolean;

  /** Derived: enabled and the current time is within [startsAt, endsAt]. */
  @Field() active!: boolean;

  @Field({ nullable: true }) createdAt?: Date;
  @Field({ nullable: true }) updatedAt?: Date;
}
