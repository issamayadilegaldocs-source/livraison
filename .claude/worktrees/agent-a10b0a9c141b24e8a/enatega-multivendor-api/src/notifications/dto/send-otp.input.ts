import { InputType, Field } from '@nestjs/graphql';
import { IsEmail, IsPhoneNumber, IsEnum } from 'class-validator';

@InputType()
export class SendOtpInput {
  @Field()
  @IsEnum(['email', 'phone'], { message: 'Method must be email or phone' })
  method: string;

  @Field({ nullable: true })
  @IsEmail()
  email?: string;

  @Field({ nullable: true })
  @IsPhoneNumber()
  phone?: string;

  @Field({ nullable: true })
  purpose?: string;
}
