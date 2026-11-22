import { Inject, UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { Types } from 'mongoose';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtUser } from '../auth/roles.enum';
import { AppPubSub, PUB_SUB } from '../pubsub/pubsub.module';
import { Events } from '../subscriptions/events';
import { ChatMessageModel, SendChatMessageResponseModel } from './chat-message.model';
import { ChatMessageInput } from './dto/chat-message.input';

@Resolver()
export class ChatResolver {
  constructor(@Inject(PUB_SUB) private readonly pubSub: AppPubSub) {}

  // Chat history is not persisted yet — messages are delivered live via
  // SubscriptionNewMessage. This query exists so clients can load a thread
  // without error; it returns an empty backlog until persistence is added.
  @UseGuards(ClerkAuthGuard)
  @Query(() => [ChatMessageModel], { name: 'chat' })
  async chat(@Args('order', { type: () => ID }) _order: string): Promise<ChatMessageModel[]> {
    return [];
  }

  @UseGuards(ClerkAuthGuard)
  @Mutation(() => ChatMessageModel, { name: 'sendMessage' })
  async sendMessage(
    @CurrentUser() jwt: JwtUser,
    @Args('order', { type: () => ID }) order: string,
    @Args('message', { type: () => String }) message: string,
    @Args('userName', { type: () => String, nullable: true }) userName?: string,
  ): Promise<ChatMessageModel> {
    const msg: ChatMessageModel = {
      id: new Types.ObjectId().toString(),
      message,
      user: { id: jwt.userId, name: userName ?? 'User' },
      createdAt: new Date().toISOString(),
    };
    await this.pubSub.publish(Events.NEW_MESSAGE, {
      [Events.NEW_MESSAGE]: { ...msg, orderId: order },
    });
    return msg;
  }

  @UseGuards(ClerkAuthGuard)
  @Mutation(() => SendChatMessageResponseModel, { name: 'sendChatMessage' })
  async sendChatMessage(
    @CurrentUser() jwt: JwtUser,
    @Args('orderId', { type: () => ID }) orderId: string,
    @Args('message', { type: () => ChatMessageInput }) messageInput: ChatMessageInput,
    @Args('userName', { type: () => String, nullable: true }) userName?: string,
  ): Promise<SendChatMessageResponseModel> {
    const msg: ChatMessageModel = {
      id: new Types.ObjectId().toString(),
      message: messageInput.message,
      user: { id: jwt.userId, name: userName ?? 'User' },
      createdAt: new Date().toISOString(),
    };
    await this.pubSub.publish(Events.NEW_MESSAGE, {
      [Events.NEW_MESSAGE]: { ...msg, orderId },
    });
    return { success: true, message: 'Message sent', data: msg };
  }

  @Subscription(() => ChatMessageModel, {
    name: 'subscriptionNewMessage',
    filter: (payload: any, variables: { order: string }) =>
      payload[Events.NEW_MESSAGE]?.orderId === variables.order,
    resolve: (payload: any) => {
      const { orderId: _orderId, ...msg } = payload[Events.NEW_MESSAGE];
      return msg;
    },
  })
  subscriptionNewMessage(@Args('order', { type: () => ID }) _order: string) {
    return this.pubSub.asyncIterableIterator(Events.NEW_MESSAGE);
  }
}
