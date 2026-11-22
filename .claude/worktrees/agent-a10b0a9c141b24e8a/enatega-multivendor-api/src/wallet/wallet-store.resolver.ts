import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Query, Resolver } from '@nestjs/graphql';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { Role, JwtUser } from '../auth/roles.enum';
import { StoreEarningsGraphResult, GrandTotalWrapper, OrderTypeEnum, PaymentMethodEnum } from './models/earnings.model';
import { DateRangeInput } from './dto/wallet.inputs';
import { WalletService } from './wallet.service';
import {
  StoreCurrentWithdrawRequestModel,
  StoreTransactionHistoryResponse,
} from './withdraw.model';

@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles(Role.STORE)
@Resolver()
export class WalletStoreResolver {
  constructor(private readonly walletService: WalletService) {}

  @Query(() => StoreEarningsGraphResult, { name: 'storeEarningsGraph' })
  storeEarningsGraph(
    @Args('storeId', { type: () => ID }) storeId: string,
    @Args('page', { type: () => Int, nullable: true }) page?: number,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('startDate', { type: () => String, nullable: true }) startDate?: string,
    @Args('endDate', { type: () => String, nullable: true }) endDate?: string,
  ) {
    return this.walletService.storeEarningsGraph(storeId, page, limit, startDate, endDate);
  }

  @Query(() => GrandTotalWrapper, { name: 'storeGrandTotalEarnings' })
  storeGrandTotalEarnings(
    @CurrentUser() jwtUser: JwtUser,
    @Args('orderType', { type: () => OrderTypeEnum, nullable: true }) orderType?: OrderTypeEnum,
    @Args('paymentMethod', { type: () => PaymentMethodEnum, nullable: true }) paymentMethod?: PaymentMethodEnum,
    @Args('dateFilter', { type: () => DateRangeInput, nullable: true }) dateFilter?: DateRangeInput,
  ) {
    return this.walletService.storeGrandTotalEarnings(
      jwtUser.userId,
      orderType,
      paymentMethod,
      dateFilter,
    );
  }

  @Query(() => StoreCurrentWithdrawRequestModel, { name: 'storeCurrentWithdrawRequest', nullable: true })
  storeCurrentWithdrawRequest(
    @CurrentUser() jwtUser: JwtUser,
  ) {
    return this.walletService.storeCurrentWithdrawRequest(jwtUser.userId);
  }

  @Query(() => StoreTransactionHistoryResponse, { name: 'storeTransactionHistory' })
  storeTransactionHistory(
    @CurrentUser() jwtUser: JwtUser,
  ) {
    return this.walletService.storeTransactionHistory(jwtUser.userId);
  }

}
