import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class PushTokenRegistrationModel {
  @Field(() => ID)
  _id: string;

  @Field({ nullable: true })
  notificationToken?: string;
}
