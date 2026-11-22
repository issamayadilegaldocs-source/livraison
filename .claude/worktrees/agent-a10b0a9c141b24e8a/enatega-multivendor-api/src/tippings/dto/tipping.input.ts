import { Field, Float, ID, InputType } from '@nestjs/graphql';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

@InputType('TippingInput')
export class TippingInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  _id?: string;

  @Field(() => [Float], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  tipVariations?: number[];

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
