import { Field, Float, ID, Int, InputType } from '@nestjs/graphql';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

@InputType()
export class CouponInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  _id?: string;

  @Field()
  @IsString()
  title!: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  discount?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  startDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  endDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  lifeTimeActive?: boolean;

  /** Max total redemptions; 0/unset = unlimited, 1 = single-use. */
  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  usageLimit?: number;
}
