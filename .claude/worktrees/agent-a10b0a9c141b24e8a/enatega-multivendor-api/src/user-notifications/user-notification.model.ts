import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('UserNotification')
export class UserNotificationModel {
  @Field(() => ID) _id!: string;
  @Field() userId!: string;
  @Field() title!: string;
  @Field() body!: string;
  @Field() type!: string;
  @Field({ nullable: true }) dataJson?: string;
  @Field() isRead!: boolean;
  @Field({ nullable: true }) createdAt?: string;
}
