import { UseGuards, NotFoundException } from '@nestjs/common';
import { Args, Float, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { IdempotencyKey } from '../common/idempotency-key.decorator';
import { Role, JwtUser } from '../auth/roles.enum';
import { OrderModel } from './order.model';
import { OrdersService } from './orders.service';
import { OrderItemInput, PlaceOrderAddressInput } from './dto/place-order.input';
import { ReviewInput } from './dto/review-order.input';
import { Configuration } from '../configuration/configuration.schema';
import { RestaurantsService } from '../restaurants/restaurants.service';

@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles(Role.CUSTOMER)
@Resolver(() => OrderModel)
export class OrdersResolver {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly restaurantsService: RestaurantsService,
    @InjectModel(Configuration.name) private readonly configModel: Model<any>,
  ) {}

  @Query(() => [OrderModel], { name: 'orders' })
  orders(
    @CurrentUser() jwt: JwtUser,
    @Args('offset', { type: () => Int, nullable: true }) offset?: number,
    @Args('page', { type: () => Int, nullable: true }) page?: number,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ) {
    const skip = offset ?? (page != null ? (page - 1) * (limit ?? 20) : 0);
    return this.ordersService.getOrdersByUser(jwt.userId, skip, limit ?? 20);
  }

  @Query(() => [OrderModel], { name: 'getUsersPastOrders' })
  getUsersPastOrders(
    @CurrentUser() jwt: JwtUser,
    @Args('page', { type: () => Int, nullable: true }) page?: number,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('offset', { type: () => Int, nullable: true }) offset?: number,
  ) {
    return this.ordersService.getUsersPastOrders(jwt.userId, page ?? 1, limit ?? 10, offset ?? 0);
  }

  @Query(() => [OrderModel], { name: 'getUsersActiveOrders' })
  getUsersActiveOrders(
    @CurrentUser() jwt: JwtUser,
    @Args('page', { type: () => Int, nullable: true }) page?: number,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('offset', { type: () => Int, nullable: true }) offset?: number,
  ) {
    return this.ordersService.getUsersActiveOrders(jwt.userId, page ?? 1, limit ?? 10, offset ?? 0);
  }

  @Query(() => OrderModel, { name: 'order', nullable: true })
  order(
    @CurrentUser() jwt: JwtUser,
    @Args('id', { type: () => String }) id: string,
  ) {
    return this.ordersService.findByIdForUser(id, jwt.userId);
  }

  @Mutation(() => OrderModel, { name: 'placeOrder' })
  async placeOrder(
    @CurrentUser() jwt: JwtUser,
    @Args('restaurant', { type: () => String }) restaurant: string,
    @Args('orderInput', { type: () => [OrderItemInput] }) orderInput: OrderItemInput[],
    @Args('paymentMethod', { type: () => String }) paymentMethod: string,
    @Args('tipping', { type: () => Float }) tipping: number,
    @Args('taxationAmount', { type: () => Float }) taxationAmount: number,
    @Args('address') address: PlaceOrderAddressInput,
    @Args('orderDate', { type: () => String }) orderDate: string,
    @Args('isPickedUp', { type: () => Boolean }) isPickedUp: boolean,
    @Args('deliveryCharges', { type: () => Float }) deliveryCharges: number,
    @Args('instructions', { type: () => String, nullable: true }) instructions?: string,
    @Args('couponCode', { type: () => String, nullable: true }) couponCode?: string,
    @Args('loyaltyPointsToRedeem', { type: () => Int, nullable: true, defaultValue: 0 }) loyaltyPointsToRedeem = 0,
    @Args('isExpress', { type: () => Boolean, nullable: true, defaultValue: false }) isExpress = false,
    // The web checkout schedules orders by sending scheduledFor alongside a
    // "now" orderDate; scheduling is derived server-side from the effective
    // order date being >60s in the future, so a provided scheduledFor simply
    // becomes that effective date.
    @Args('scheduledFor', { type: () => String, nullable: true }) scheduledFor?: string,
    @IdempotencyKey() idempotencyKey?: string,
  ) {
    const restaurantDoc = await this.restaurantsService.findOrderPlacementProfile(restaurant);
    if (!restaurantDoc) throw new NotFoundException('Restaurant not found');

    const config = await this.configModel.findOne().lean().exec();
    const maxTipPercentage = ((config as any)?.maxTipPercentage ?? 25) / 100;

    const foodTotal = orderInput.reduce((sum, item: any) => {
      const varPrice = item.variation?.price ?? 0;
      const addonTotal = (item.addons ?? []).reduce(
        (aSum: number, addon: any) =>
          aSum +
          (addon.options ?? []).reduce((oSum: number, opt: any) => oSum + (opt.price ?? 0), 0),
        0,
      );
      return sum + (varPrice + addonTotal) * (item.quantity ?? 1);
    }, 0);

    const cappedTip = Math.max(0, Math.min(tipping, foodTotal * maxTipPercentage));

    // Tax and delivery are recomputed server-side inside `placeOrder` from the
    // restaurant's configured rate and the delivery distance; the client-supplied
    // `taxationAmount` / `deliveryCharges` are passed through only for logging and
    // are not trusted for the money math.
    return this.ordersService.placeOrder(
      jwt.userId,
      restaurant,
      orderInput,
      paymentMethod,
      cappedTip,
      taxationAmount,
      address,
      scheduledFor ?? orderDate,
      isPickedUp,
      deliveryCharges,
      instructions,
      couponCode,
      loyaltyPointsToRedeem,
      isExpress,
      idempotencyKey,
    );
  }

  @Mutation(() => OrderModel, { name: 'abortOrder' })
  abortOrder(
    @CurrentUser() jwt: JwtUser,
    @Args('id', { type: () => String }) id: string,
  ) {
    return this.ordersService.abortOrder(jwt.userId, id);
  }

  // A customer typo'd/redirected delivery address is one of the most common
  // real-world support contacts before pickup; letting them self-serve it
  // while the order is still PENDING/ACCEPTED avoids a cancel-and-reorder
  // round trip that loses their place in the restaurant's queue plus any
  // already-applied coupon/loyalty redemption.
  @Mutation(() => OrderModel, { name: 'updateOrderDeliveryAddress' })
  updateOrderDeliveryAddress(
    @CurrentUser() jwt: JwtUser,
    @Args('id', { type: () => String }) id: string,
    @Args('address', { type: () => PlaceOrderAddressInput }) address: PlaceOrderAddressInput,
  ) {
    return this.ordersService.updateDeliveryAddress(jwt.userId, id, {
      label: address.label,
      deliveryAddress: address.deliveryAddress,
      details: address.details,
      coordinates: address.location?.coordinates,
    });
  }

  @Mutation(() => OrderModel, { name: 'reviewOrder' })
  reviewOrder(
    @CurrentUser() jwt: JwtUser,
    @Args('reviewInput') reviewInput: ReviewInput,
  ) {
    return this.ordersService.reviewOrder(jwt.userId, reviewInput);
  }

  @Mutation(() => OrderModel, { name: 'markOrderDelivered' })
  markOrderDelivered(
    @CurrentUser() jwt: JwtUser,
    @Args('id', { type: () => String }) id: string,
  ) {
    return this.ordersService.markOrderDelivered(id, jwt.userId);
  }

  @Mutation(() => OrderModel, { name: 'reOrder' })
  reOrder(
    @CurrentUser() jwt: JwtUser,
    @Args('orderId', { type: () => String }) orderId: string,
    @Args('address') address: PlaceOrderAddressInput,
    @Args('deliveryCharges', { type: () => Float }) deliveryCharges: number,
    @Args('tipping', { type: () => Float, defaultValue: 0 }) tipping: number,
    @Args('isPickedUp', { type: () => Boolean, defaultValue: false }) isPickedUp: boolean,
    @Args('paymentMethod', { type: () => String, defaultValue: 'CASH' }) paymentMethod: string,
  ) {
    return this.ordersService.reOrder(
      jwt.userId,
      orderId,
      address,
      deliveryCharges,
      tipping,
      isPickedUp,
      paymentMethod,
    );
  }
}
