import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class NotificationStatusModel {
  @Field(() => ID, { nullable: true }) _id?: string;
  @Field({ nullable: true }) notificationToken?: string;
  @Field({ nullable: true }) isOrderNotification?: boolean;
  @Field({ nullable: true }) isOfferNotification?: boolean;
}
