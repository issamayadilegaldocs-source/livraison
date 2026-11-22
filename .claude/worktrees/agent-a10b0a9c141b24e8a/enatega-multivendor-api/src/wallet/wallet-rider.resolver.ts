import { UseGuards } from '@nestjs/common';
import { Args, Float, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { Role, JwtUser } from '../auth/roles.enum';
import { RiderEarningsGraphResult, GrandTotalWrapper, OrderTypeEnum, PaymentMethodEnum } from './models/earnings.model';
import { StoreCurrentWithdrawRequestModel, WithdrawRequestResponse } from './withdraw.model';
import { DateRangeInput } from './dto/wallet.inputs';
import { WalletService } from './wallet.service';

@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles(Role.RIDER)
@Resolver()
export class WalletRiderResolver {
  constructor(private readonly walletService: WalletService) {}

  @Query(() => RiderEarningsGraphResult, { name: 'riderEarningsGraph' })
  riderEarningsGraph(
    @Args('riderId', { type: () => ID }) riderId: string,
    @Args('page', { type: () => Int, nullable: true }) page?: number,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('startDate', { type: () => String, nullable: true }) startDate?: string,
    @Args('endDate', { type: () => String, nullable: true }) endDate?: string,
  ) {
    return this.walletService.riderEarningsGraph(riderId, page, limit, startDate, endDate);
  }

  @Query(() => GrandTotalWrapper, { name: 'riderGrandTotalEarnings' })
  riderGrandTotalEarnings(
    @CurrentUser() jwtUser: JwtUser,
    @Args('userType', { type: () => String, nullable: true }) _userType?: string,
    @Args('userId', { type: () => String, nullable: true }) _userId?: string,
    @Args('orderType', { type: () => OrderTypeEnum, nullable: true }) orderType?: OrderTypeEnum,
    @Args('paymentMethod', { type: () => PaymentMethodEnum, nullable: true }) paymentMethod?: PaymentMethodEnum,
    @Args('dateFilter', { type: () => DateRangeInput, nullable: true }) dateFilter?: DateRangeInput,
  ) {
    return this.walletService.riderGrandTotalEarnings(
      jwtUser.userId,
      orderType,
      paymentMethod,
      dateFilter,
    );
  }

  @Query(() => StoreCurrentWithdrawRequestModel, { name: 'riderCurrentWithdrawRequest', nullable: true })
  riderCurrentWithdrawRequest(
    @CurrentUser() jwtUser: JwtUser,
    @Args('riderId', { type: () => String, nullable: true }) _riderId?: string,
  ) {
    return this.walletService.riderCurrentWithdrawRequest(jwtUser.userId);
  }

  @Roles(Role.RIDER, Role.STORE, Role.VENDOR)
  @Mutation(() => WithdrawRequestResponse, { name: 'createWithdrawRequest' })
  async createWithdrawRequest(
    @CurrentUser() jwtUser: JwtUser,
    @Args('requestAmount', { type: () => Float }) requestAmount: number,
  ) {
    if (jwtUser.role === Role.STORE || jwtUser.role === Role.VENDOR) {
      return this.walletService.createWithdrawRequestStore(jwtUser.userId, requestAmount);
    }
    return this.walletService.createWithdrawRequest(jwtUser.userId, requestAmount);
  }
}
