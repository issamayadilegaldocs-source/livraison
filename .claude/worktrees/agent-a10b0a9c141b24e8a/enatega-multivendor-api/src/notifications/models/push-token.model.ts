import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class PushTokenModel {
  @Field(() => ID)
  _id: string;

  @Field()
  token: string;

  @Field({ nullable: true })
  pushToken?: string;

  @Field()
  platform: string;

  @Field()
  userType: string;

  @Field()
  userId: string;

  @Field()
  active: boolean;

  @Field({ nullable: true })
  lastUsedAt?: Date;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
