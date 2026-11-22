import { Field, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsOptional, IsString } from 'class-validator';

@InputType()
export class EarningsPaginationInput {
  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  page?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  rows?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  limit?: number;
}

@InputType()
export class WithdrawPaginationInput {
  @Field(() => Int)
  @IsInt()
  pageSize!: number;

  @Field(() => Int)
  @IsInt()
  pageNo!: number;
}

@InputType()
export class DateRangeInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  startDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  endDate?: string;
}

/** Legacy clients send snake_case keys; both spellings are accepted. */
@InputType('DateFilter')
export class DateFilterInput {
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
  @IsString()
  starting_date?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  ending_date?: string;
}
