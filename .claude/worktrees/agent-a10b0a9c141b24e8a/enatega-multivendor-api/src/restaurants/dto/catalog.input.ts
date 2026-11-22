import { Field, Float, ID, InputType, Int } from '@nestjs/graphql';
import {
  IsArray,
  IsBoolean,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { SubCategoryInput } from '../../sub-categories/dto/sub-category.input';

// Clients send `_id: ""` for not-yet-created entities. Normalize empty
// strings to `undefined` so @IsOptional() skips @IsMongoId() on create.
const emptyToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const decimalStringToNumber = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;

  const normalized = value.trim().replace(/\s/g, '').replace(',', '.');
  if (normalized === '') return undefined;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : value;
};

@InputType('VariationInput')
export class VariationInput {
  @Transform(emptyToUndefined) @IsOptional() @IsString() @Field({ nullable: true }) _id?: string;
  @IsOptional() @IsString() @Field({ nullable: true }) title?: string;
  @Transform(decimalStringToNumber) @IsOptional() @IsNumber() @Field(() => Float, { nullable: true }) price?: number;
  @Transform(decimalStringToNumber) @IsOptional() @IsNumber() @Field(() => Float, { nullable: true }) discounted?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) @Field(() => [String], { nullable: true }) addons?: string[];
  @IsOptional() @IsBoolean() @Field({ nullable: true }) isOutOfStock?: boolean;
}

@InputType('CategoryInput')
export class CategoryInput {
  @Transform(emptyToUndefined) @IsOptional() @IsMongoId() @Field({ nullable: true }) _id?: string;
  @IsMongoId() @Field() restaurant!: string;
  @IsString() @Field() title!: string;
  @IsOptional() @IsString() @Field({ nullable: true }) image?: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubCategoryInput)
  @Field(() => [SubCategoryInput], { nullable: true })
  subCategories?: SubCategoryInput[];
}

@InputType('FoodInput')
export class FoodInput {
  @Transform(emptyToUndefined) @IsOptional() @IsMongoId() @Field({ nullable: true }) _id?: string;
  @IsMongoId() @Field() restaurant!: string;
  @IsMongoId() @Field() category!: string;
  @IsString() @Field() title!: string;
  @IsOptional() @IsString() @Field({ nullable: true }) description?: string;
  @IsOptional() @IsString() @Field({ nullable: true }) image?: string;
  @Transform(emptyToUndefined) @IsOptional() @IsString() @Field({ nullable: true }) subCategory?: string;
  @IsOptional() @IsBoolean() @Field({ nullable: true }) isActive?: boolean;
  @IsOptional() @IsBoolean() @Field({ nullable: true }) isOutOfStock?: boolean;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariationInput)
  @Field(() => [VariationInput], { nullable: true })
  variations?: VariationInput[];
}

@InputType('AddonItemInput')
export class AddonItemInput {
  @IsString() @Field() title!: string;
  @IsOptional() @IsString() @Field({ nullable: true }) description?: string;
  @IsOptional() @IsNumber() @Field(() => Int, { nullable: true }) quantityMinimum?: number;
  @IsOptional() @IsNumber() @Field(() => Int, { nullable: true }) quantityMaximum?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) @Field(() => [String], { nullable: true }) options?: string[];
}

@InputType('AddonItemEditInput')
export class AddonItemEditInput {
  @IsMongoId() @Field() _id!: string;
  @IsOptional() @IsString() @Field({ nullable: true }) title?: string;
  @IsOptional() @IsString() @Field({ nullable: true }) description?: string;
  @IsOptional() @IsNumber() @Field(() => Int, { nullable: true }) quantityMinimum?: number;
  @IsOptional() @IsNumber() @Field(() => Int, { nullable: true }) quantityMaximum?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) @Field(() => [String], { nullable: true }) options?: string[];
}

@InputType('AddonInput')
export class AddonInput {
  @IsMongoId() @Field() restaurant!: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddonItemInput)
  @Field(() => [AddonItemInput])
  addons!: AddonItemInput[];
}

@InputType('editAddonInput')
export class EditAddonInput {
  @IsMongoId() @Field() restaurant!: string;
  @ValidateNested()
  @Type(() => AddonItemEditInput)
  @Field(() => AddonItemEditInput)
  addons!: AddonItemEditInput;
}

@InputType('OptionItemInput')
export class OptionItemInput {
  @Transform(emptyToUndefined) @IsOptional() @IsMongoId() @Field({ nullable: true }) _id?: string;
  @IsString() @Field() title!: string;
  @IsOptional() @IsString() @Field({ nullable: true }) description?: string;
  @Transform(decimalStringToNumber) @IsOptional() @IsNumber() @Field(() => Float, { nullable: true }) price?: number;
}

@InputType('CreateOptionInput')
export class CreateOptionInput {
  @IsMongoId() @Field() restaurant!: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OptionItemInput)
  @Field(() => [OptionItemInput])
  options!: OptionItemInput[];
}

@InputType('editOptionInput')
export class EditOptionInput {
  @IsMongoId() @Field() _id!: string;
  @IsMongoId() @Field() restaurant!: string;
  @IsOptional() @IsString() @Field({ nullable: true }) title?: string;
  @IsOptional() @IsString() @Field({ nullable: true }) description?: string;
  @Transform(decimalStringToNumber) @IsOptional() @IsNumber() @Field(() => Float, { nullable: true }) price?: number;
}
