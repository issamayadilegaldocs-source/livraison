import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class CouponModel {
  @Field(() => ID) _id!: string;
  @Field() title!: string;
  @Field(() => Float, { nullable: true }) discount?: number;
  @Field({ nullable: true }) enabled?: boolean;
  @Field({ nullable: true }) startDate?: string;
  @Field({ nullable: true }) endDate?: string;
  @Field({ nullable: true }) lifeTimeActive?: boolean;
  @Field(() => Int, { nullable: true }) usageLimit?: number;
  @Field(() => Int, { nullable: true }) timesUsed?: number;
}
