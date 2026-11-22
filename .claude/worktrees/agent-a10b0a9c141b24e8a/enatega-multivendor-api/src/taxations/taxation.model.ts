import { Field, Float, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('TaxationType')
export class TaxationModel {
  @Field(() => ID) _id!: string;
  @Field(() => Float) taxationCharges!: number;
  @Field() enabled!: boolean;
}
