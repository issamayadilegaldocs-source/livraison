import { Field, InputType } from '@nestjs/graphql';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

@InputType('BannerInput')
export class BannerInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  _id?: string;

  @Field()
  @IsString()
  title!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  action?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  file?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  badgeText?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  buttonText?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  promoCode?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  backgroundColor?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  textColor?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  accentColor?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  buttonBackgroundColor?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  buttonTextColor?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  screen?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  parameters?: string;
}
