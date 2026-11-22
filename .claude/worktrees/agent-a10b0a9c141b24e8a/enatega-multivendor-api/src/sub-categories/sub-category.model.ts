import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('SubCategory')
export class SubCategoryModel {
  @Field(() => ID) _id!: string;
  @Field({ nullable: true }) title?: string;
  @Field({ nullable: true }) parentCategoryId?: string;
}
