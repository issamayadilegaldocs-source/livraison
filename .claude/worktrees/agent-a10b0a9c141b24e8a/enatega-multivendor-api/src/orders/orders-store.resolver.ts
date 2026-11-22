import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { Role, JwtUser } from '../auth/roles.enum';
import { OrderModel } from './order.model';
import { OrdersService } from './orders.service';

@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles(Role.STORE, Role.VENDOR)
@Resolver()
export class OrdersStoreResolver {
  constructor(private readonly ordersService: OrdersService) {}

  @Query(() => [OrderModel], { name: 'restaurantOrders' })
  async restaurantOrders(@CurrentUser() jwt: JwtUser) {
    const restaurantId = await this.ordersService.resolveRestaurantMongoId(jwt.userId);
    return this.ordersService.getRestaurantOrders(restaurantId);
  }

  @Mutation(() => OrderModel, { name: 'acceptOrder' })
  async acceptOrder(
    @CurrentUser() jwt: JwtUser,
    @Args('_id', { type: () => String }) id: string,
    @Args('time', { type: () => String, nullable: true }) time?: string,
  ) {
    const restaurantId = await this.ordersService.resolveRestaurantMongoId(jwt.userId);
    return this.ordersService.acceptOrder(id, restaurantId, time);
  }

  @Mutation(() => OrderModel, { name: 'cancelOrder' })
  async cancelOrder(
    @CurrentUser() jwt: JwtUser,
    @Args('_id', { type: () => String }) id: string,
    @Args('reason', { type: () => String }) reason: string,
  ) {
    const restaurantId = await this.ordersService.resolveRestaurantMongoId(jwt.userId);
    return this.ordersService.cancelOrder(id, restaurantId, reason);
  }

  @Mutation(() => OrderModel, { name: 'orderPickedUp' })
  async orderPickedUp(
    @CurrentUser() jwt: JwtUser,
    @Args('_id', { type: () => String }) id: string,
  ) {
    const restaurantId = await this.ordersService.resolveRestaurantMongoId(jwt.userId);
    return this.ordersService.orderPickedUp(id, restaurantId);
  }

  @Mutation(() => OrderModel, { name: 'markOrderPrepared' })
  async markOrderPrepared(
    @CurrentUser() jwt: JwtUser,
    @Args('_id', { type: () => String }) id: string,
  ) {
    const restaurantId = await this.ordersService.resolveRestaurantMongoId(jwt.userId);
    return this.ordersService.markOrderPrepared(id, restaurantId);
  }

  @Mutation(() => Boolean, { name: 'muteRing' })
  muteRing(@Args('orderId', { type: () => String, nullable: true }) orderId?: string) {
    if (!orderId) return false;
    return this.ordersService.muteRing(orderId);
  }
}
