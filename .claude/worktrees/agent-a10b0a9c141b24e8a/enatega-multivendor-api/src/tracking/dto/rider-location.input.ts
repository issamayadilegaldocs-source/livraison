import { Type } from 'class-transformer';
import { IsDate, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Field, Float, GraphQLISODateTime, ID, InputType } from '@nestjs/graphql';

@InputType('RiderLocationInput')
export class RiderLocationInput {
  @Field(() => Float)
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(-90)
  @Max(90)
  latitude!: number;

  @Field(() => Float)
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(-180)
  @Max(180)
  longitude!: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  @Max(10_000)
  accuracyMeters?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  @Max(360)
  headingDegrees?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  @Max(150)
  speedMetersPerSecond?: number;

  @Field(() => GraphQLISODateTime)
  @Type(() => Date)
  @IsDate()
  capturedAt!: Date;

  @Field(() => ID)
  @IsUUID()
  updateId!: string;
}
