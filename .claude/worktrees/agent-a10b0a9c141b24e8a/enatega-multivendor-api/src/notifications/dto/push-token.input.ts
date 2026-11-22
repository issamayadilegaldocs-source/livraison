import { InputType, Field } from '@nestjs/graphql';
import { IsString, IsEnum } from 'class-validator';

@InputType()
export class PushTokenInput {
  @Field()
  @IsString()
  token: string;

  @Field()
  @IsEnum(['web', 'ios', 'android'], { message: 'Platform must be web, ios, or android' })
  platform: string;
}
