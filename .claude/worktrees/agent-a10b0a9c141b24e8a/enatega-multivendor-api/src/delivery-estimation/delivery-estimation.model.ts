import { Field, Int, ObjectType } from '@nestjs/graphql';

/** A relative, minutes-from-now estimate. Orders persist an absolute ISO timestamp. */
@ObjectType()
export class DeliveryTimeEstimate {
  @Field(() => Int) totalMinutes!: number;
  @Field(() => Int) travelMinutes!: number;
  @Field(() => Int) prepMinutes!: number;
  @Field() source!: 'static' | 'dynamic';
}
