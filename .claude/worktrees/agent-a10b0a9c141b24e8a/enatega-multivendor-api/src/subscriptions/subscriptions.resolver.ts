import { ForbiddenException, Inject, UseGuards } from '@nestjs/common';
import { Args, Resolver, Subscription } from '@nestjs/graphql';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Role, JwtUser } from '../auth/roles.enum';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AppPubSub, PUB_SUB } from '../pubsub/pubsub.module';
import { Events } from './events';
import {
  FoodStockChangedPayload,
  OrderEventPayload,
  RiderAssignedPayload,
  RiderUpdatedPayload,
  ZoneOrderPayload,
} from './models/subscription-payloads.model';
import { OrderModel } from '../orders/order.model';
import { OrdersService } from '../orders/orders.service';
import { RidersService } from '../riders/riders.service';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { UsersService } from '../users/users.service';

@UseGuards(ClerkAuthGuard)
@Resolver()
export class SubscriptionsResolver {
  constructor(
    @Inject(PUB_SUB) private readonly pubSub: AppPubSub,
    private readonly ridersService: RidersService,
    private readonly ordersService: OrdersService,
    private readonly restaurantsService: RestaurantsService,
    private readonly usersService: UsersService,
  ) {}

  /** Resolves the caller's own restaurant id, or null if they don't manage one. */
  private async ownRestaurantId(jwt: JwtUser): Promise<string | null> {
    try {
      return await this.restaurantsService.resolveMongoIdByClerkId(jwt.userId);
    } catch {
      return null;
    }
  }

  /** Resolves the caller's own customer (Mongo) id, or null if they aren't linked. */
  private async ownUserId(jwt: JwtUser): Promise<string | null> {
    try {
      return String(await this.usersService.resolveMongoIdByClerkId(jwt.userId));
    } catch {
      return null;
    }
  }

  @Subscription(() => OrderModel, {
    name: 'subscriptionOrder',
    filter: (payload: any, variables: { id: string }) =>
      payload[Events.ORDER_STATUS_CHANGED]?.orderId === variables.id,
    resolve: (payload: any) => payload[Events.ORDER_STATUS_CHANGED]?.order,
  })
  async subscriptionOrder(
    @CurrentUser() jwt: JwtUser,
    @Args('id', { type: () => String }) id: string,
  ) {
    if (jwt.role !== Role.ADMIN) {
      const refs = await this.ordersService.getOrderActorRefs(id);
      if (!refs) throw new ForbiddenException('Order not found');
      const [ownRestaurantId, ownUserId] = await Promise.all([
        this.ownRestaurantId(jwt),
        this.ownUserId(jwt),
      ]);
      const rider = await this.ridersService.findByClerkId(jwt.userId).catch(() => null);
      const riderId = rider ? String((rider as any)._id) : null;
      const riderZoneId = rider ? String((rider as any)?.zone?._id ?? (rider as any)?.zone ?? '') : null;
      const isOwnOrder =
        (ownUserId && refs.userId === ownUserId) ||
        (ownRestaurantId && refs.restaurantId === ownRestaurantId) ||
        (riderId && refs.riderId === riderId) ||
        (riderZoneId && refs.zoneId === riderZoneId);
      if (!isOwnOrder) throw new ForbiddenException('Not your order');
    }
    return this.pubSub.asyncIterableIterator(Events.ORDER_STATUS_CHANGED);
  }

  @Subscription(() => OrderEventPayload, {
    name: 'orderStatusChanged',
    filter: (payload: any, variables: { userId: string }) =>
      payload[Events.ORDER_STATUS_CHANGED]?.userId === variables.userId,
    resolve: (payload: any) => payload[Events.ORDER_STATUS_CHANGED],
  })
  async orderStatusChanged(
    @CurrentUser() jwt: JwtUser,
    @Args('userId', { type: () => String }) userId: string,
  ) {
    if (jwt.role !== Role.ADMIN) {
      const ownUserId = await this.ownUserId(jwt);
      if (!ownUserId || ownUserId !== userId) throw new ForbiddenException('Not your order stream');
    }
    return this.pubSub.asyncIterableIterator(Events.ORDER_STATUS_CHANGED);
  }

  @Subscription(() => OrderEventPayload, {
    name: 'subscribePlaceOrder',
    filter: (payload: any, variables: { restaurant: string }) =>
      payload[Events.ORDER_PLACED]?.restaurantId === variables.restaurant,
    resolve: (payload: any) => payload[Events.ORDER_PLACED],
  })
  async subscribePlaceOrder(
    @CurrentUser() jwt: JwtUser,
    @Args('restaurant', { type: () => String }) restaurant: string,
  ) {
    if (jwt.role !== Role.ADMIN) {
      const ownRestaurantId = await this.ownRestaurantId(jwt);
      if (!ownRestaurantId || ownRestaurantId !== restaurant) {
        throw new ForbiddenException('Not your restaurant');
      }
    }
    return this.pubSub.asyncIterableIterator(Events.ORDER_PLACED);
  }

  @Subscription(() => OrderModel, {
    name: 'subscriptionDispatcher',
    // Without a restaurantId the subscriber is the global admin dispatcher
    // and receives every placed order.
    filter: (payload: any, variables: { restaurantId?: string }) =>
      !variables.restaurantId ||
      payload[Events.ORDER_PLACED]?.restaurantId === variables.restaurantId,
    resolve: (payload: any) => payload[Events.ORDER_PLACED]?.order,
  })
  async subscriptionDispatcher(
    @CurrentUser() jwt: JwtUser,
    @Args('restaurantId', { type: () => String, nullable: true }) restaurantId?: string,
  ) {
    if (jwt.role !== Role.ADMIN) {
      if (!restaurantId) throw new ForbiddenException('Global dispatcher is admin-only');
      const ownRestaurantId = await this.ownRestaurantId(jwt);
      if (!ownRestaurantId || ownRestaurantId !== restaurantId) {
        throw new ForbiddenException('Not your restaurant');
      }
    }
    return this.pubSub.asyncIterableIterator(Events.ORDER_PLACED);
  }

  @Subscription(() => ZoneOrderPayload, {
    name: 'subscriptionZoneOrders',
    filter: (payload: any, variables: { zoneId: string }) =>
      !!payload[Events.ORDER_PLACED]?.zoneId &&
      payload[Events.ORDER_PLACED]?.zoneId === variables.zoneId,
    resolve: (payload: any) => {
      const data = payload[Events.ORDER_PLACED];
      return { zoneId: data?.zoneId, origin: data?.origin, order: data?.order };
    },
  })
  @UseGuards(RolesGuard)
  @Roles(Role.RIDER)
  async subscriptionZoneOrders(
    @CurrentUser() jwt: JwtUser,
    @Args('zoneId', { type: () => String }) zoneId: string,
  ) {
    const rider = await this.ridersService.findByClerkId(jwt.userId);
    const riderZoneId = String((rider as any)?.zone?._id ?? (rider as any)?.zone ?? '');
    if (!rider || riderZoneId !== zoneId) throw new ForbiddenException('Not your rider zone');
    return this.pubSub.asyncIterableIterator(Events.ORDER_PLACED);
  }

  @Subscription(() => RiderAssignedPayload, {
    name: 'subscriptionAssignRider',
    filter: (payload: any, variables: { riderId: string }) =>
      payload[Events.RIDER_ASSIGNED]?.riderId === variables.riderId,
    resolve: (payload: any) => payload[Events.RIDER_ASSIGNED],
  })
  @UseGuards(RolesGuard)
  @Roles(Role.RIDER)
  async subscriptionAssignRider(
    @CurrentUser() jwt: JwtUser,
    @Args('riderId', { type: () => String }) riderId: string,
  ) {
    const rider = await this.ridersService.findByClerkId(jwt.userId);
    if (!rider || String((rider as any)._id) !== riderId) {
      throw new ForbiddenException('Not your rider assignment stream');
    }
    return this.pubSub.asyncIterableIterator(Events.RIDER_ASSIGNED);
  }

  @Subscription(() => OrderModel, {
    name: 'subscriptionRestaurantOrderStatus',
    filter: (payload: any, variables: { restaurantId: string }) =>
      payload[Events.ORDER_STATUS_CHANGED]?.restaurantId === variables.restaurantId,
    resolve: (payload: any) => payload[Events.ORDER_STATUS_CHANGED]?.order,
  })
  async subscriptionRestaurantOrderStatus(
    @CurrentUser() jwt: JwtUser,
    @Args('restaurantId', { type: () => String }) restaurantId: string,
  ) {
    if (jwt.role !== Role.ADMIN) {
      const ownRestaurantId = await this.ownRestaurantId(jwt);
      if (!ownRestaurantId || ownRestaurantId !== restaurantId) {
        throw new ForbiddenException('Not your restaurant');
      }
    }
    return this.pubSub.asyncIterableIterator(Events.ORDER_STATUS_CHANGED);
  }

  @Subscription(() => RiderUpdatedPayload, {
    name: 'RiderUpdated',
    filter: (payload: any, variables: { riderId?: string }) => {
      if (!variables.riderId) return true;
      return payload[Events.RIDER_UPDATED]?._id === variables.riderId;
    },
    resolve: (payload: any) => payload[Events.RIDER_UPDATED],
  })
  riderUpdated(@Args('riderId', { type: () => String, nullable: true }) _riderId?: string) {
    return this.pubSub.asyncIterableIterator(Events.RIDER_UPDATED);
  }

  @Subscription(() => FoodStockChangedPayload, {
    name: 'foodStockChanged',
    filter: (payload: any, variables: { restaurantId: string }) =>
      payload[Events.FOOD_STOCK_CHANGED]?.restaurantId === variables.restaurantId,
    resolve: (payload: any) => payload[Events.FOOD_STOCK_CHANGED],
  })
  foodStockChanged(
    @Args('restaurantId', { type: () => String }) _restaurantId: string,
  ) {
    return this.pubSub.asyncIterableIterator(Events.FOOD_STOCK_CHANGED);
  }
}
