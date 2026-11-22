import { Field, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsOptional, IsString } from 'class-validator';

@InputType()
export class ReviewInput {
  @Field()
  @IsString()
  order!: string;

  @Field(() => Int)
  @IsInt()
  rating!: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;
}
