import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('ChatUser')
export class ChatUserModel {
  @Field(() => ID) id!: string;
  @Field({ nullable: true }) name?: string;
}

@ObjectType('ChatMessage')
export class ChatMessageModel {
  @Field(() => ID) id!: string;
  @Field({ nullable: true }) message?: string;
  @Field(() => ChatUserModel, { nullable: true }) user?: ChatUserModel;
  @Field({ nullable: true }) createdAt?: string;
}

@ObjectType('SendChatMessageResponse')
export class SendChatMessageResponseModel {
  @Field() success!: boolean;
  @Field({ nullable: true }) message?: string;
  @Field(() => ChatMessageModel, { nullable: true }) data?: ChatMessageModel;
}
