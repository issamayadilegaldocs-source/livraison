import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class WebNotificationModel {
  @Field(() => ID) _id!: string;
  @Field() body!: string;
  @Field({ nullable: true }) navigateTo?: string;
  @Field({ nullable: true }) read?: boolean;
  @Field({ nullable: true }) createdAt?: string;
}
