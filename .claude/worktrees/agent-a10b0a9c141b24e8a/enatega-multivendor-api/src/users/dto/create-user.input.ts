import { Field, InputType } from '@nestjs/graphql';
import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

/** Mirrors the `userInput` argument of the client `createUser` mutation. */
@InputType()
export class CreateUserInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  phone?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsEmail()
  email?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notificationToken?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  appleId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  emailIsVerified?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isPhoneExists?: boolean;
}
