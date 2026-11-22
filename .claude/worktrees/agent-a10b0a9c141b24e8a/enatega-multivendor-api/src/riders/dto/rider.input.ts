import { Field, ID, InputType } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

const emptyToUndefined = ({ value }: { value: unknown }) =>
  value === '' ? undefined : value;

@InputType('LicenseDetailsInput')
export class LicenseDetailsInput {
  @Field({ nullable: true }) @IsOptional() @IsString() number?: string;
  @Field({ nullable: true }) @IsOptional() @IsString() expiryDate?: string;
  @Field({ nullable: true }) @IsOptional() @IsString() image?: string;
}

@InputType('VehicleDetailsInput')
export class VehicleDetailsInput {
  @Field({ nullable: true }) @IsOptional() @IsString() number?: string;
  @Field({ nullable: true }) @IsOptional() @IsString() image?: string;
}

@InputType('RiderTimeSlotInput')
export class TimeSlotInput {
  @Field() @IsString() startTime!: string;
  @Field() @IsString() endTime!: string;
}

@InputType('DayScheduleInput')
export class DayScheduleInput {
  @Field() @IsString() day!: string;
  @Field() @IsBoolean() enabled!: boolean;
  @Field(() => [TimeSlotInput])
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotInput)
  slots!: TimeSlotInput[];
}

@InputType('RiderInput')
export class RiderInput {
  @Field(() => ID, { nullable: true })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsMongoId()
  _id?: string;

  @Field({ nullable: true }) @IsOptional() @IsString() name?: string;
  @Field({ nullable: true }) @IsOptional() @IsString() username?: string;
  @Field({ nullable: true }) @IsOptional() @IsString() password?: string;
  @Field({ nullable: true }) @IsOptional() @IsEmail() email?: string;
  @Field({ nullable: true }) @IsOptional() @IsString() phone?: string;
  @Field({ nullable: true }) @IsOptional() @IsString() image?: string;
  @Field({ nullable: true }) @IsOptional() @IsString() timeZone?: string;
  @Field({ nullable: true }) @IsOptional() @IsBoolean() available?: boolean;
  @Field({ nullable: true }) @IsOptional() @IsBoolean() isActive?: boolean;
  @Field({ nullable: true }) @IsOptional() @IsString() accountNumber?: string;
  @Field({ nullable: true })
  @IsOptional()
  @IsIn(['bicycle', 'motorbike', 'car', 'pickup_truck'])
  vehicleType?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsMongoId()
  zone?: string;
}
