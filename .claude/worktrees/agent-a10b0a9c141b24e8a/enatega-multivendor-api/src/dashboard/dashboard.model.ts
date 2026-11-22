import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';

// ── Super-admin dashboard ──────────────────────────────────────────────────

@ObjectType('DashboardPercentageChange')
export class DashboardPercentageChangeModel {
  @Field(() => Float, { nullable: true }) usersPercent?: number;
  @Field(() => Float, { nullable: true }) vendorsPercent?: number;
  @Field(() => Float, { nullable: true }) restaurantsPercent?: number;
  @Field(() => Float, { nullable: true }) ridersPercent?: number;
}

@ObjectType('DashboardUsersStats')
export class DashboardUsersStatsModel {
  @Field(() => Int, { nullable: true }) usersCount?: number;
  @Field(() => Int, { nullable: true }) vendorsCount?: number;
  @Field(() => Int, { nullable: true }) restaurantsCount?: number;
  @Field(() => Int, { nullable: true }) ridersCount?: number;
  @Field(() => DashboardPercentageChangeModel, { nullable: true })
  percentageChange?: DashboardPercentageChangeModel;
}

@ObjectType('DashboardTypeData')
export class DashboardTypeDataModel {
  @Field(() => Float, { nullable: true }) value?: number;
  @Field({ nullable: true }) label?: string;
}

// ── Restaurant dashboard ───────────────────────────────────────────────────

@ObjectType('RestaurantDashboardStats')
export class RestaurantDashboardStatsModel {
  @Field(() => Int, { nullable: true }) totalOrders?: number;
  @Field(() => Float, { nullable: true }) totalSales?: number;
  @Field(() => Int, { nullable: true }) totalCODOrders?: number;
  @Field(() => Int, { nullable: true }) totalCardOrders?: number;
}

@ObjectType('YearlySalesOrderStats')
export class YearlySalesOrderStatsModel {
  @Field(() => [Float], { nullable: true }) salesAmount?: number[];
  @Field(() => [Int], { nullable: true }) ordersCount?: number[];
}

@ObjectType('PaymentMethodData')
export class PaymentMethodDataModel {
  @Field(() => Int, { nullable: true }) total_orders?: number;
  @Field(() => Float, { nullable: true }) total_sales?: number;
  @Field(() => Float, { nullable: true }) total_sales_without_delivery?: number;
  @Field(() => Float, { nullable: true }) total_delivery_fee?: number;
}

@ObjectType('PaymentMethodStats')
export class PaymentMethodStatsModel {
  @Field({ nullable: true }) _type?: string;
  @Field(() => PaymentMethodDataModel, { nullable: true })
  data?: PaymentMethodDataModel;
}

@ObjectType('OrderSalesByPaymentMethodResult')
export class OrderSalesByPaymentMethodResultModel {
  @Field(() => PaymentMethodStatsModel, { nullable: true })
  all?: PaymentMethodStatsModel;
  @Field(() => PaymentMethodStatsModel, { nullable: true })
  cod?: PaymentMethodStatsModel;
  @Field(() => PaymentMethodStatsModel, { nullable: true })
  card?: PaymentMethodStatsModel;
}

// ── Vendor dashboard ───────────────────────────────────────────────────────

@ObjectType('StoreDetails')
export class StoreDetailsModel {
  @Field(() => ID, { nullable: true }) _id?: string;
  @Field(() => Int, { nullable: true }) totalOrders?: number;
  @Field({ nullable: true }) restaurantName?: string;
  @Field(() => Float, { nullable: true }) totalSales?: number;
  @Field(() => Int, { nullable: true }) pickUpCount?: number;
  @Field(() => Int, { nullable: true }) deliveryCount?: number;
}

@ObjectType('VendorStatsCard')
export class VendorStatsCardModel {
  @Field(() => Int, { nullable: true }) totalRestaurants?: number;
  @Field(() => Int, { nullable: true }) totalOrders?: number;
  @Field(() => Float, { nullable: true }) totalSales?: number;
  @Field(() => Int, { nullable: true }) totalDeliveries?: number;
}

@ObjectType('LiveMonitorData')
export class LiveMonitorDataModel {
  @Field(() => Int, { nullable: true }) online_stores?: number;
  @Field(() => Int, { nullable: true }) cancelled_orders?: number;
  @Field(() => Int, { nullable: true }) delayed_orders?: number;
  @Field(() => Float, { nullable: true }) ratings?: number;
}

@ObjectType('VendorGrowthStats')
export class VendorGrowthStatsModel {
  @Field(() => [Int], { nullable: true }) totalRestaurants?: number[];
  @Field(() => [Int], { nullable: true }) totalOrders?: number[];
  @Field(() => [Float], { nullable: true }) totalSales?: number[];
}
