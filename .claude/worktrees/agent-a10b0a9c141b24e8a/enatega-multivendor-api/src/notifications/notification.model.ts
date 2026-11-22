import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class NotificationModel {
  @Field(() => ID) _id!: string;
  @Field() title!: string;
  @Field() body!: string;
  @Field({ nullable: true }) createdAt?: string;
}
