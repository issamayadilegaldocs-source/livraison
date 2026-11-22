import { Field, Float, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('City')
export class CityModel {
  @Field(() => ID) id!: string;
  @Field() name!: string;
  @Field(() => Float, { nullable: true }) latitude?: number;
  @Field(() => Float, { nullable: true }) longitude?: number;
}

@ObjectType('Country')
export class CountryModel {
  @Field(() => ID) _id!: string;
  @Field() name!: string;
  @Field({ nullable: true }) flag?: string;
}

@ObjectType('CountryWithCities')
export class CountryWithCitiesModel {
  @Field(() => ID) id!: string;
  @Field() name!: string;
  @Field(() => [CityModel], { nullable: true }) cities?: CityModel[];
}
