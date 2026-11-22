import { Field, Float, InputType, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { CoordinatesInput } from '../../common/dto/geo.input';
import { TimeValueScalar } from '../../common/scalars/time-value.scalar';

@InputType('RestaurantTimeSlotInput')
export class TimeSlotInput {
  @Field(() => TimeValueScalar, { nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startTime?: string;

  @Field(() => TimeValueScalar, { nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  endTime?: string;
}

@InputType('OpeningTimeInput')
export class OpeningTimeInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @IsIn(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'])
  day?: string;

  @Field(() => [TimeSlotInput], { nullable: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotInput)
  times?: TimeSlotInput[];
}

@InputType('TimingsInput')
export class TimingsInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @IsIn(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'])
  day?: string;

  @Field(() => [TimeSlotInput], { nullable: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotInput)
  times?: TimeSlotInput[];
}

@InputType('DeliveryInfoInput')
export class DeliveryInfoInput {
  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  minDeliveryFee?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  deliveryDistance?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  deliveryFee?: number;
}

@InputType('BussinessDetailsInput')
export class BussinessDetailsInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  bankName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  accountName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  accountCode?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  accountNumber?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  bussinessRegNo?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  companyRegNo?: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  taxRate?: number;
}

@InputType('RestaurantInput')
export class RestaurantInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  unique_restaurant_id?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  orderPrefix?: string;

  @Field()
  @IsString()
  name!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  image?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  logo?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  slug?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  phone?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  address?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  city?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  postCode?: string;

  @Field(() => CoordinatesInput)
  @ValidateNested()
  @Type(() => CoordinatesInput)
  location!: CoordinatesInput;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  deliveryTime?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  minimumOrder?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  tax?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  salesTax?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  commissionRate?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  username?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  password?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @Field(() => [OpeningTimeInput], { nullable: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OpeningTimeInput)
  openingTimes?: OpeningTimeInput[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  shopType?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  shopCategory?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cuisines?: string[];
}

@InputType('RestaurantProfileInput')
export class RestaurantProfileInput {
  @Field()
  @IsString()
  _id!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  image?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  logo?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  slug?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  phone?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  address?: string;

  @Field(() => CoordinatesInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => CoordinatesInput)
  location?: CoordinatesInput;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  orderPrefix?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  deliveryTime?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  minimumOrder?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  tax?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  salesTax?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  username?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  password?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @Field(() => [OpeningTimeInput], { nullable: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OpeningTimeInput)
  openingTimes?: OpeningTimeInput[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  shopType?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  shopCategory?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cuisines?: string[];

  @Field(() => DeliveryInfoInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => DeliveryInfoInput)
  deliveryInfo?: DeliveryInfoInput;
}
