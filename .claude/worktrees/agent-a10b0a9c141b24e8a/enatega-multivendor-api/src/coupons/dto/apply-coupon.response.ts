import { Field, ObjectType } from '@nestjs/graphql';
import { CouponModel } from '../coupon.model';

@ObjectType()
export class ApplyCouponResponse {
  @Field(() => CouponModel, { nullable: true }) coupon?: CouponModel;
  @Field({ nullable: true }) message?: string;
  @Field({ nullable: true }) success?: boolean;
}
