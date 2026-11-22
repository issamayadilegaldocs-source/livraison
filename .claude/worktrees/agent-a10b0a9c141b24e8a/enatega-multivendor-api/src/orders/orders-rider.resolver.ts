import { UseGuards, NotFoundException } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { Role, JwtUser } from '../auth/roles.enum';
import { OrderModel } from './order.model';
import { OrdersService } from './orders.service';
import { RidersService } from '../riders/riders.service';

@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles(Role.RIDER)
@Resolver()
export class OrdersRiderResolver {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly ridersService: RidersService,
  ) {}

  @Query(() => [OrderModel], { name: 'riderOrders' })
  async riderOrders(@CurrentUser() jwt: JwtUser) {
    const rider = await this.ridersService.findByClerkId(jwt.userId);
    if (!rider) return [];
    return this.ordersService.findVisibleForRider(rider);
  }

  @Mutation(() => OrderModel, { name: 'updateOrderStatusRider' })
  async updateOrderStatusRider(
    @CurrentUser() jwt: JwtUser,
    @Args('id', { type: () => String }) id: string,
    @Args('status', { type: () => String }) status: string,
    @Args('codCollected', { type: () => Boolean, nullable: true }) codCollected?: boolean,
  ) {
    const rider = await this.ridersService.findByClerkId(jwt.userId);
    if (!rider) throw new NotFoundException('Rider not found');
    return this.ordersService.updateOrderStatusRider(id, String(rider._id), status, codCollected);
  }

  @Mutation(() => OrderModel, { name: 'markOrderArrived' })
  async markOrderArrived(
    @CurrentUser() jwt: JwtUser,
    @Args('id', { type: () => String }) id: string,
  ) {
    const rider = await this.ridersService.findByClerkId(jwt.userId);
    if (!rider) throw new NotFoundException('Rider not found');
    return this.ordersService.updateOrderStatusRider(id, String(rider._id), 'ARRIVED');
  }

  @Mutation(() => OrderModel, { name: 'assignOrder' })
  async assignOrder(
    @CurrentUser() jwt: JwtUser,
    @Args('id', { type: () => String }) id: string,
  ) {
    const rider = await this.ridersService.findByClerkId(jwt.userId);
    if (!rider) throw new NotFoundException('Rider not found');
    return this.ordersService.assignOrder(String(rider._id), id);
  }

  @Mutation(() => OrderModel, { name: 'rejectRiderAssignment' })
  async rejectRiderAssignment(
    @CurrentUser() jwt: JwtUser,
    @Args('id', { type: () => String }) id: string,
  ) {
    const rider = await this.ridersService.findByClerkId(jwt.userId);
    if (!rider) throw new NotFoundException('Rider not found');
    return this.ordersService.rejectRiderAssignment(String(rider._id), id);
  }
}
