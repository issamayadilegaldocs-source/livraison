import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ObjectType, Field, ID } from '@nestjs/graphql';

export type OtpDocument = HydratedDocument<Otp>;

@ObjectType()
@Schema({ collection: 'otps', timestamps: true })
export class Otp {
  @Field(() => ID)
  _id: string;

  @Prop({ required: true })
  @Field()
  code: string;

  @Prop({ required: true, enum: ['email', 'phone'] })
  @Field()
  method: string;

  @Prop({ required: true })
  @Field()
  destination: string;

  @Prop({ required: true })
  @Field()
  userId: string;

  @Prop({ required: true, enum: ['CUSTOMER', 'STORE', 'RIDER', 'ADMIN'] })
  @Field()
  userType: string;

  @Prop({ enum: ['signup', 'password_reset', 'phone_verify', 'email_verify'] })
  @Field({ nullable: true })
  purpose?: string;

  @Prop({ default: false })
  @Field()
  verified: boolean;

  @Prop({ default: 0 })
  @Field()
  attempts: number;

  @Prop()
  @Field({ nullable: true })
  verifiedAt?: Date;

  @Prop({ default: () => new Date(Date.now() + 10 * 60 * 1000) })
  @Field()
  expiresAt: Date;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

export const OtpSchema = SchemaFactory.createForClass(Otp);
OtpSchema.index({ destination: 1, verified: 1 });
OtpSchema.index({ userId: 1, purpose: 1 });
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
