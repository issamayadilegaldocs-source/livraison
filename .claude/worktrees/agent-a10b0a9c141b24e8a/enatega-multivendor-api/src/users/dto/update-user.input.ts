import { Field, InputType } from '@nestjs/graphql';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

@InputType()
export class UpdateUserInput {
  @Field()
  @IsString()
  name!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  phone?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  phoneIsVerified?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  emailIsVerified?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  preferredLanguage?: string;
}
