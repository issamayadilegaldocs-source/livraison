import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('LoyaltyAccount')
export class LoyaltyAccountModel {
  @Field(() => ID) _id!: string;
  @Field() userId!: string;
  @Field(() => Int) points!: number;
  @Field(() => Int) lifetimePoints!: number;
  @Field({ nullable: true }) updatedAt?: string;
}
