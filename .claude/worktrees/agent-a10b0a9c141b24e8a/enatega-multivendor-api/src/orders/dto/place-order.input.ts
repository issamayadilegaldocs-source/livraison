import { Field, Float, InputType, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

@InputType()
export class OrderAddonInput {
  @Field()
  @IsString()
  _id!: string;

  @Field(() => [String])
  @IsArray()
  @IsString({ each: true })
  options!: string[];
}

@InputType()
export class OrderItemInput {
  @Field()
  @IsString()
  food!: string;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  quantity!: number;

  @Field()
  @IsString()
  variation!: string;

  @Field(() => [OrderAddonInput], { nullable: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderAddonInput)
  addons?: OrderAddonInput[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  specialInstructions?: string;
}

/** Backward-compatible alias used by the mobile customer app. */
@InputType()
export class OrderInput {
  @Field()
  @IsString()
  food!: string;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  quantity!: number;

  @Field()
  @IsString()
  variation!: string;

  @Field(() => [OrderAddonInput], { nullable: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderAddonInput)
  addons?: OrderAddonInput[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  specialInstructions?: string;
}

@InputType()
export class PlaceOrderLocationInput {
  @Field(() => [Float])
  @IsArray()
  @IsNumber({}, { each: true })
  coordinates!: number[];
}

@InputType()
export class PlaceOrderAddressInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  _id?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  label?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  deliveryAddress?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  details?: string;

  @Field(() => PlaceOrderLocationInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => PlaceOrderLocationInput)
  location?: PlaceOrderLocationInput;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  longitude?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  latitude?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  selected?: boolean;
}
