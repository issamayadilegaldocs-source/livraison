import { Field, Float, ID, InputType } from '@nestjs/graphql';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';

@InputType()
export class OfferInput {
  // Required only for edit; validated in the service.
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsMongoId()
  _id?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @Field()
  @IsIn(['FIXED', 'PERCENTAGE'])
  type!: string;

  @Field(() => Float)
  @IsNumber()
  @IsPositive()
  value!: number;

  @Field()
  @IsDateString()
  startsAt!: string;

  @Field()
  @IsDateString()
  endsAt!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsIn(['CART', 'ITEMS'])
  scope?: string;

  @Field(() => [ID], { nullable: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsMongoId({ each: true })
  targetFoodIds?: string[];

  @Field(() => [ID], { nullable: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsMongoId({ each: true })
  targetCategoryIds?: string[];

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderAmount?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  maxDiscount?: number;
}
