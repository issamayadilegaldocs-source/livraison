import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('ShopType')
export class ShopTypeModel {
  @Field(() => ID)
  _id!: string;

  @Field()
  name!: string;

  @Field({ nullable: true })
  image?: string;

  @Field({ nullable: true })
  slug?: string;

  @Field({ nullable: true })
  isActive?: boolean;
}

@ObjectType('ShopTypesPaginated')
export class ShopTypesPaginatedModel {
  @Field(() => [ShopTypeModel])
  data!: ShopTypeModel[];

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  pageSize!: number;

  @Field(() => Int)
  totalPages!: number;

  @Field()
  hasNextPage!: boolean;

  @Field()
  hasPrevPage!: boolean;
}
