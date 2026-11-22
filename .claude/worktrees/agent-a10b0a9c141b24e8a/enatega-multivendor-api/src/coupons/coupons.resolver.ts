import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Resolver } from '@nestjs/graphql';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';
import { ApplyCouponResponse } from './dto/apply-coupon.response';
import { CouponsService } from './coupons.service';

@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles(Role.CUSTOMER)
@Resolver()
export class CouponsResolver {
  constructor(private readonly couponsService: CouponsService) {}

  @Mutation(() => ApplyCouponResponse, { name: 'applyCoupon' })
  applyCoupon(
    @Args('coupon', { type: () => String }) coupon: string,
    @Args('restaurantId', { type: () => ID }) restaurantId: string,
  ) {
    return this.couponsService.applyCoupon(coupon, restaurantId);
  }

  @Mutation(() => ApplyCouponResponse, { name: 'coupon' })
  couponAlias(
    @Args('coupon', { type: () => String }) coupon: string,
    @Args('restaurantId', { type: () => ID, nullable: true }) restaurantId?: string,
  ) {
    return this.couponsService.applyCoupon(coupon, restaurantId ?? '');
  }
}
