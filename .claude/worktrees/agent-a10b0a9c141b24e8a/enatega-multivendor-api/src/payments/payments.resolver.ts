import { UseGuards } from '@nestjs/common';
import { Args, Float, Mutation, Resolver } from '@nestjs/graphql';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { Role, JwtUser } from '../auth/roles.enum';
import { OrderModel } from '../orders/order.model';
import { OrdersService } from '../orders/orders.service';
import { PaymentsService } from './payments.service';

@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles(Role.CUSTOMER)
@Resolver()
export class PaymentsResolver {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly ordersService: OrdersService,
  ) {}

  /** Returns the Flouci hosted-checkout link for an order (web drives the redirect). */
  @Mutation(() => String, { name: 'initiateFlouciPayment' })
  async initiateFlouciPayment(
    @CurrentUser() _jwt: JwtUser,
    @Args('orderId', { type: () => String }) orderId: string,
  ): Promise<string> {
    const { link } = await this.paymentsService.initiateOrderPayment(orderId);
    return link;
  }

  /** Re-checks payment status with the gateway and returns the updated order. */
  @Mutation(() => OrderModel, { name: 'verifyFlouciPayment' })
  async verifyFlouciPayment(
    @CurrentUser() jwt: JwtUser,
    @Args('orderId', { type: () => String }) orderId: string,
  ): Promise<OrderModel> {
    await this.paymentsService.confirmOrderPayment(orderId);
    return this.ordersService.findByIdForUser(
      orderId,
      jwt.userId,
    ) as unknown as Promise<OrderModel>;
  }

  /** Initiates a Flouci top-up for the customer's wallet. Returns the gateway link. */
  @Mutation(() => String, { name: 'initiateWalletTopUp' })
  async initiateWalletTopUp(
    @CurrentUser() jwt: JwtUser,
    @Args('amount', { type: () => Float }) amount: number,
  ): Promise<string> {
    return this.paymentsService.initiateWalletTopUp(jwt.userId, amount);
  }
}
