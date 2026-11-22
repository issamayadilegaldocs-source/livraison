import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ObjectType, Field, ID } from '@nestjs/graphql';

export type PushTokenDocument = HydratedDocument<PushToken>;

@ObjectType()
@Schema({ collection: 'push_tokens', timestamps: true })
export class PushToken {
  @Field(() => ID)
  _id: string;

  @Prop({ required: true })
  @Field()
  token: string;

  @Prop({ required: true, enum: ['web', 'ios', 'android', 'mobile'] })
  @Field()
  platform: string;

  @Prop({ required: true, enum: ['CUSTOMER', 'STORE', 'VENDOR', 'RIDER', 'ADMIN'] })
  @Field()
  userType: string;

  @Prop({ required: true })
  @Field()
  userId: string;

  @Prop({ default: true })
  @Field()
  active: boolean;

  @Prop()
  @Field({ nullable: true })
  deactivatedAt?: Date;

  @Prop()
  @Field({ nullable: true })
  deactivationReason?: string;

  @Prop()
  @Field({ nullable: true })
  lastUsedAt?: Date;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

export const PushTokenSchema = SchemaFactory.createForClass(PushToken);
PushTokenSchema.index({ userId: 1, platform: 1 });
PushTokenSchema.index({ token: 1 });
