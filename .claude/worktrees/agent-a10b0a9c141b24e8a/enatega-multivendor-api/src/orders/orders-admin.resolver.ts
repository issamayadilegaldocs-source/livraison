import { UseGuards } from '@nestjs/common';
import { Args, Float, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';
import {
  ActiveOrdersResultModel,
  AllOrdersPaginatedModel,
  OrderModel,
  OrdersByUserResultModel,
} from './order.model';
import { ReviewModel } from './review.model';
import { OrdersService } from './orders.service';

@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Resolver()
export class OrdersAdminResolver {
  constructor(private readonly ordersService: OrdersService) {}

  @Query(() => OrdersByUserResultModel, { name: 'ordersByUser' })
  ordersByUser(
    @Args('userId', { type: () => String }) userId: string,
    @Args('page', { type: () => Int, nullable: true }) page?: number,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ) {
    return this.ordersService.getOrdersByUserId(userId, page ?? 1, limit ?? 10);
  }

  @Query(() => [OrderModel], { name: 'allOrders' })
  allOrders(@Args('page', { type: () => Int, nullable: true }) page?: number) {
    return this.ordersService.getAllOrders(page ?? 1);
  }

  @Query(() => [OrderModel], { name: 'ordersByRestId' })
  ordersByRestId(
    @Args('restaurant', { type: () => String }) restaurant: string,
    @Args('page', { type: () => Int, nullable: true }) page?: number,
    @Args('rows', { type: () => Int, nullable: true }) rows?: number,
    @Args('search', { type: () => String, nullable: true }) search?: string,
  ) {
    return this.ordersService.getOrdersByRestaurant(restaurant, page ?? 1, rows ?? 10, search);
  }

  @Query(() => [OrderModel], { name: 'ordersByRestIdWithoutPagination' })
  ordersByRestIdWithoutPagination(
    @Args('restaurant', { type: () => String }) restaurant: string,
    @Args('search', { type: () => String, nullable: true }) search?: string,
  ) {
    return this.ordersService.getOrdersByRestaurantWithoutPagination(restaurant, search);
  }

  @Query(() => ActiveOrdersResultModel, { name: 'getActiveOrders' })
  getActiveOrders(
    @Args('restaurantId', { type: () => ID, nullable: true }) restaurantId?: string,
    @Args('page', { type: () => Int, nullable: true }) page?: number,
    @Args('rowsPerPage', { type: () => Int, nullable: true }) rowsPerPage?: number,
    @Args('actions', { type: () => [String], nullable: true }) actions?: string[],
    @Args('search', { type: () => String, nullable: true }) search?: string,
  ) {
    return this.ordersService.getActiveOrders(restaurantId, page ?? 1, rowsPerPage ?? 10, actions, search);
  }

  @Query(() => AllOrdersPaginatedModel, { name: 'allOrdersPaginated' })
  allOrdersPaginated(
    @Args('page', { type: () => Int, nullable: true }) page?: number,
    @Args('rows', { type: () => Int, nullable: true }) rows?: number,
    @Args('starting_date', { type: () => String, nullable: true }) starting_date?: string,
    @Args('ending_date', { type: () => String, nullable: true }) ending_date?: string,
    @Args('orderStatus', { type: () => [String], nullable: true }) orderStatus?: string[],
    @Args('search', { type: () => String, nullable: true }) search?: string,
    @Args('dateKeyword', { type: () => String, nullable: true }) dateKeyword?: string,
  ) {
    return this.ordersService.getAllOrdersPaginated(
      page ?? 1,
      rows ?? 10,
      starting_date,
      ending_date,
      orderStatus,
      search,
      dateKeyword,
    );
  }

  @Query(() => [OrderModel], { name: 'allOrdersWithoutPagination' })
  allOrdersWithoutPagination(
    @Args('starting_date', { type: () => String, nullable: true }) starting_date?: string,
    @Args('ending_date', { type: () => String, nullable: true }) ending_date?: string,
    @Args('dateKeyword', { type: () => String, nullable: true }) dateKeyword?: string,
  ) {
    return this.ordersService.getAllOrdersWithoutPagination(starting_date, ending_date, dateKeyword);
  }

  @Mutation(() => OrderModel, { name: 'updateStatus' })
  updateStatus(
    @Args('id', { type: () => String }) id: string,
    @Args('orderStatus', { type: () => String }) orderStatus: string,
    @Args('override', { type: () => Boolean, nullable: true }) override?: boolean,
  ) {
    return this.ordersService.updateStatus(id, orderStatus, override ?? false);
  }

  @Mutation(() => OrderModel, { name: 'assignRider' })
  assignRider(
    @Args('id', { type: () => String }) id: string,
    @Args('riderId', { type: () => String }) riderId: string,
  ) {
    return this.ordersService.assignRider(id, riderId);
  }

  @Mutation(() => OrderModel, { name: 'forceCompleteOrder' })
  forceCompleteOrder(@Args('id', { type: () => String }) id: string) {
    return this.ordersService.forceCompleteOrder(id);
  }

  @Mutation(() => OrderModel, { name: 'setDeliveryBonus' })
  setDeliveryBonus(
    @Args('id', { type: () => String }) id: string,
    @Args('amount', { type: () => Float }) amount: number,
  ) {
    return this.ordersService.setDeliveryBonus(id, amount);
  }

  @Mutation(() => OrderModel, { name: 'recomputeDeliveryBonus' })
  recomputeDeliveryBonus(@Args('id', { type: () => String }) id: string) {
    return this.ordersService.recomputeDeliveryBonus(id);
  }

  @Mutation(() => OrderModel, { name: 'refundOrder' })
  refundOrder(
    @Args('id', { type: () => String }) id: string,
    @Args('reason', { type: () => String, nullable: true }) reason?: string,
  ) {
    return this.ordersService.refundOrderToWallet(id, reason);
  }

  @Query(() => [ReviewModel], { name: 'reviews' })
  reviews(@Args('restaurant', { type: () => String }) restaurant: string) {
    return this.ordersService.findReviewsByRestaurant(restaurant);
  }

  // Surfaces the same staleness signal the escalation cron already acts on
  // automatically (unassigned past N minutes in PREPARED/ACCEPTED), so an
  // ops agent can see and manually intervene on a stuck order instead of only
  // finding out when a customer calls.
  @Query(() => [OrderModel], { name: 'ordersNeedingAttention' })
  ordersNeedingAttention(
    @Args('thresholdMinutes', { type: () => Int, nullable: true }) thresholdMinutes?: number,
  ) {
    return this.ordersService.getOrdersNeedingAttention(thresholdMinutes ?? 10);
  }
}
