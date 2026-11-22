import { Field, InputType } from '@nestjs/graphql';
import { IsString } from 'class-validator';

@InputType('ChatMessageInput')
export class ChatMessageInput {
  @Field()
  @IsString()
  message!: string;
}
