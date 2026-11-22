import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class OtpModel {
  @Field(() => ID)
  _id: string;

  @Field()
  code: string;

  @Field({ nullable: true })
  result?: boolean;

  @Field()
  method: string;

  @Field()
  destination: string;

  @Field()
  userType: string;

  @Field({ nullable: true })
  purpose?: string;

  @Field()
  verified: boolean;

  @Field()
  attempts: number;

  @Field({ nullable: true })
  verifiedAt?: Date;

  @Field()
  expiresAt: Date;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
