import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('Cuisine')
export class CuisineModel {
  @Field(() => ID)
  _id!: string;

  @Field()
  name!: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  image?: string;

  @Field({ nullable: true })
  shopType?: string;
}
