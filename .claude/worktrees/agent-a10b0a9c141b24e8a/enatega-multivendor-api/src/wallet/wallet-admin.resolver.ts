import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { Role, JwtUser } from '../auth/roles.enum';
import { AuditService } from '../audit/audit.service';
import { EarningsResponse, UserTypeEnum, OrderTypeEnum, PaymentMethodEnum } from './models/earnings.model';
import { RiderAndWithdrawRequestModel, TransactionHistoryResult, WithdrawRequestModel, WithdrawRequestsResult } from './withdraw.model';
import { DateFilterInput, WithdrawPaginationInput } from './dto/wallet.inputs';
import { PaginationInput } from '../common/dto/pagination.input';
import { WalletService } from './wallet.service';

@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Resolver()
export class WalletAdminResolver {
  constructor(
    private readonly walletService: WalletService,
    private readonly auditService: AuditService,
  ) {}

  @Query(() => EarningsResponse, { name: 'earnings' })
  @Roles(Role.ADMIN, Role.VENDOR, Role.STORE, Role.RIDER)
  getEarning(
    @Args('userType', { type: () => UserTypeEnum, nullable: true }) userType?: UserTypeEnum,
    @Args('userId', { type: () => String, nullable: true }) userId?: string,
    @Args('orderType', { type: () => OrderTypeEnum, nullable: true }) orderType?: OrderTypeEnum,
    @Args('paymentMethod', { type: () => PaymentMethodEnum, nullable: true }) paymentMethod?: PaymentMethodEnum,
    @Args('pagination', { type: () => PaginationInput, nullable: true }) pagination?: PaginationInput,
    @Args('dateFilter', { type: () => DateFilterInput, nullable: true }) dateFilter?: DateFilterInput,
    @Args('search', { type: () => String, nullable: true }) search?: string,
  ) {
    return this.walletService.getEarning({ userType, userId, orderType, paymentMethod, pagination, dateFilter, search });
  }

  @Query(() => TransactionHistoryResult, { name: 'transactionHistory' })
  @Roles(Role.ADMIN, Role.VENDOR, Role.STORE, Role.RIDER)
  getTransactionHistory(
    @Args('userType', { type: () => UserTypeEnum, nullable: true }) userType?: UserTypeEnum,
    @Args('userId', { type: () => String, nullable: true }) userId?: string,
    @Args('pagination', { type: () => PaginationInput, nullable: true }) pagination?: PaginationInput,
    @Args('dateFilter', { type: () => DateFilterInput, nullable: true }) dateFilter?: DateFilterInput,
    @Args('search', { type: () => String, nullable: true }) search?: string,
  ) {
    return this.walletService.getTransactionHistory({ userType, userId, pagination, dateFilter, search });
  }

  @Mutation(() => WithdrawRequestModel, { name: 'approveWithdrawRequest' })
  async approveWithdrawRequest(
    @CurrentUser() jwt: JwtUser,
    @Args('withdrawId', { type: () => String }) withdrawId: string,
    @Args('approvedAmount', { type: () => Number }) approvedAmount: number,
  ) {
    const result = await this.walletService.approveWithdrawRequest(withdrawId, approvedAmount);
    this.auditService.create(jwt.userId, jwt.userId, 'APPROVE_WITHDRAW', 'WithdrawRequest', withdrawId, String(approvedAmount)).catch(() => undefined);
    return result;
  }

  @Mutation(() => WithdrawRequestModel, { name: 'rejectWithdrawRequest' })
  async rejectWithdrawRequest(
    @CurrentUser() jwt: JwtUser,
    @Args('withdrawId', { type: () => String }) withdrawId: string,
    @Args('reason', { type: () => String, nullable: true }) reason?: string,
  ) {
    const result = await this.walletService.rejectWithdrawRequest(withdrawId, reason ?? '');
    this.auditService.create(jwt.userId, jwt.userId, 'REJECT_WITHDRAW', 'WithdrawRequest', withdrawId, reason).catch(() => undefined);
    return result;
  }

  @Query(() => WithdrawRequestsResult, { name: 'withdrawRequests' })
  withdrawRequests(
    @Args('userType', { type: () => UserTypeEnum, nullable: true }) userType?: UserTypeEnum,
    @Args('userId', { type: () => String, nullable: true }) userId?: string,
    @Args('pagination', { type: () => WithdrawPaginationInput }) pagination: WithdrawPaginationInput = { pageSize: 10, pageNo: 1 },
    @Args('search', { type: () => String, nullable: true }) search?: string,
  ) {
    return this.walletService.getWithdrawRequests({ userType, userId, pagination, search });
  }

  @Mutation(() => RiderAndWithdrawRequestModel, { name: 'updateWithdrawReqStatus' })
  async updateWithdrawReqStatus(
    @Args('id', { type: () => String }) id: string,
    @Args('status', { type: () => String }) status: string,
  ) {
    return this.walletService.updateWithdrawReqStatus(id, status);
  }
}
