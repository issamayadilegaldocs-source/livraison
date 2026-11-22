import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('Staff')
export class StaffModel {
  @Field(() => ID) _id!: string;
  @Field({ nullable: true }) name?: string;
  @Field({ nullable: true }) email?: string;
  @Field({ nullable: true }) phone?: string;
  @Field({ nullable: true }) isActive?: boolean;
  @Field(() => [String], { nullable: true }) permissions?: string[];
  @Field({ nullable: true }) userType?: string;
}
