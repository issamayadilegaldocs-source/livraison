import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { Role, JwtUser } from '../auth/roles.enum';
import { AuditService } from '../audit/audit.service';
import { CouponModel } from './coupon.model';
import { CouponInput } from './dto/coupon.input';
import { CouponsService } from './coupons.service';

@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Resolver(() => CouponModel)
export class CouponsAdminResolver {
  constructor(
    private readonly couponsService: CouponsService,
    private readonly auditService: AuditService,
  ) {}

  @Query(() => [CouponModel], { name: 'coupons' })
  findAll() {
    return this.couponsService.findAll();
  }

  @Query(() => [CouponModel], { name: 'restaurantCoupons' })
  restaurantCoupons(@Args('restaurantId', { type: () => ID }) restaurantId: string) {
    return this.couponsService.findByRestaurant(restaurantId);
  }

  @Mutation(() => CouponModel, { name: 'createCoupon' })
  create(@Args('couponInput') input: CouponInput) {
    return this.couponsService.create(input);
  }

  @Mutation(() => CouponModel, { name: 'editCoupon' })
  async edit(
    @CurrentUser() jwt: JwtUser,
    @Args('couponInput') input: CouponInput,
  ) {
    const result = await this.couponsService.edit(input);
    this.auditService.create(jwt.userId, jwt.userId, 'EDIT_COUPON', 'Coupon', input._id ?? '').catch(() => undefined);
    return result;
  }

  @Mutation(() => Boolean, { name: 'deleteCoupon' })
  async delete(
    @CurrentUser() jwt: JwtUser,
    @Args('id', { type: () => String }) id: string,
  ) {
    const result = await this.couponsService.delete(id);
    this.auditService.create(jwt.userId, jwt.userId, 'DELETE_COUPON', 'Coupon', id).catch(() => undefined);
    return result;
  }

  // ── Restaurant-scoped coupon mutations ───────────────────────────────────

  @Mutation(() => CouponModel, { name: 'createRestaurantCoupon' })
  createRestaurantCoupon(
    @Args('restaurantId', { type: () => ID }) restaurantId: string,
    @Args('couponInput', { type: () => CouponInput }) couponInput: CouponInput,
  ) {
    return this.couponsService.createRestaurantCoupon(restaurantId, couponInput);
  }

  @Mutation(() => CouponModel, { name: 'editRestaurantCoupon' })
  editRestaurantCoupon(
    @Args('restaurantId', { type: () => ID }) restaurantId: string,
    @Args('couponInput', { type: () => CouponInput }) couponInput: CouponInput,
  ) {
    return this.couponsService.editRestaurantCoupon(restaurantId, couponInput);
  }

  @Mutation(() => Boolean, { name: 'deleteRestaurantCoupon' })
  deleteRestaurantCoupon(
    @Args('restaurantId', { type: () => ID }) restaurantId: string,
    @Args('couponId', { type: () => ID }) couponId: string,
  ) {
    return this.couponsService.deleteRestaurantCoupon(restaurantId, couponId);
  }
}
