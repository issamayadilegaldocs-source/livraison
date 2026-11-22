import { Field, Float, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('Tipping')
export class TippingModel {
  @Field(() => ID) _id!: string;
  @Field(() => [Float]) tipVariations!: number[];
  @Field() enabled!: boolean;
}
