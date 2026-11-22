import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString } from 'class-validator';

@InputType('SubCategoryInput')
export class SubCategoryInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  _id?: string;

  @Field()
  @IsString()
  title!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  parentCategoryId?: string;
}
