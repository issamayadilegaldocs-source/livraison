import { Field, InputType, registerEnumType } from '@nestjs/graphql';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export enum DeleteTypeEnum {
  SOFT = 'SOFT',
  HARD = 'HARD',
}
registerEnumType(DeleteTypeEnum, { name: 'DeleteTypeEnum' });

@InputType('FetchShopTypeFilter')
export class FetchShopTypeFilter {
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;
}

@InputType('FetchUniqueShopTypeInput')
export class FetchUniqueShopTypeInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  _id?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  slug?: string;
}

@InputType('CreateShopTypeInput')
export class CreateShopTypeInput {
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
  slug?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@InputType('UpdateShopTypeInput')
export class UpdateShopTypeInput {
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
  slug?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
