import { InputType, Field } from '@nestjs/graphql';
import { IsString, Length } from 'class-validator';

@InputType()
export class VerifyOtpInput {
  @Field()
  @IsString()
  @Length(4, 8, { message: 'OTP code must be between 4 and 8 characters' })
  code: string;

  @Field()
  @IsString()
  destination: string;
}
