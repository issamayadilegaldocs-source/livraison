import { Field, Float, ID, InputType } from '@nestjs/graphql';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

@InputType('TaxationInput')
export class TaxationInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  _id?: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  taxationCharges?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
