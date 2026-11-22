import { UseGuards } from '@nestjs/common';
import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';
import {
  DashboardTypeDataModel,
  DashboardUsersStatsModel,
  LiveMonitorDataModel,
  OrderSalesByPaymentMethodResultModel,
  RestaurantDashboardStatsModel,
  StoreDetailsModel,
  VendorGrowthStatsModel,
  VendorStatsCardModel,
  YearlySalesOrderStatsModel,
} from './dashboard.model';
import { DashboardService } from './dashboard.service';

@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Resolver()
export class DashboardResolver {
  constructor(private readonly dashboardService: DashboardService) {}

  // ── super-admin ───────────────────────────────────────────────────────────

  @Query(() => DashboardUsersStatsModel, { name: 'getDashboardUsers' })
  getDashboardUsers() {
    return this.dashboardService.getDashboardUsers();
  }

  @Query(() => DashboardUsersStatsModel, { name: 'getDashboardUsersByYear' })
  getDashboardUsersByYear(
    @Args('year', { type: () => Int }) year: number,
  ) {
    return this.dashboardService.getDashboardUsersByYear(year);
  }

  @Query(() => [DashboardTypeDataModel], { name: 'getDashboardOrdersByType' })
  getDashboardOrdersByType() {
    return this.dashboardService.getDashboardOrdersByType();
  }

  @Query(() => [DashboardTypeDataModel], { name: 'getDashboardSalesByType' })
  getDashboardSalesByType() {
    return this.dashboardService.getDashboardSalesByType();
  }

  // ── restaurant ────────────────────────────────────────────────────────────

  @Query(() => RestaurantDashboardStatsModel, {
    name: 'getRestaurantDashboardOrdersSalesStats',
  })
  getRestaurantDashboardOrdersSalesStats(
    @Args('restaurant', { type: () => String }) restaurant: string,
    @Args('starting_date', { type: () => String }) starting_date: string,
    @Args('ending_date', { type: () => String }) ending_date: string,
    @Args('dateKeyword', { type: () => String, nullable: true })
    dateKeyword?: string,
  ) {
    return this.dashboardService.getRestaurantDashboardOrdersSalesStats(
      restaurant,
      starting_date,
      ending_date,
      dateKeyword,
    );
  }

  @Query(() => YearlySalesOrderStatsModel, {
    name: 'getRestaurantDashboardSalesOrderCountDetailsByYear',
  })
  getRestaurantDashboardSalesOrderCountDetailsByYear(
    @Args('restaurant', { type: () => String }) restaurant: string,
    @Args('year', { type: () => Int }) year: number,
  ) {
    return this.dashboardService.getRestaurantDashboardSalesOrderCountDetailsByYear(
      restaurant,
      year,
    );
  }

  @Query(() => OrderSalesByPaymentMethodResultModel, {
    name: 'getDashboardOrderSalesDetailsByPaymentMethod',
  })
  getDashboardOrderSalesDetailsByPaymentMethod(
    @Args('restaurant', { type: () => String }) restaurant: string,
    @Args('starting_date', { type: () => String }) starting_date: string,
    @Args('ending_date', { type: () => String }) ending_date: string,
  ) {
    return this.dashboardService.getDashboardOrderSalesDetailsByPaymentMethod(
      restaurant,
      starting_date,
      ending_date,
    );
  }

  // ── vendor ────────────────────────────────────────────────────────────────

  @Query(() => [StoreDetailsModel], { name: 'getStoreDetailsByVendorId' })
  getStoreDetailsByVendorId(
    @Args('id', { type: () => String }) id: string,
    @Args('dateKeyword', { type: () => String, nullable: true })
    dateKeyword?: string,
    @Args('starting_date', { type: () => String, nullable: true })
    starting_date?: string,
    @Args('ending_date', { type: () => String, nullable: true })
    ending_date?: string,
  ) {
    return this.dashboardService.getStoreDetailsByVendorId(
      id,
      dateKeyword,
      starting_date,
      ending_date,
    );
  }

  @Query(() => VendorStatsCardModel, {
    name: 'getVendorDashboardStatsCardDetails',
  })
  getVendorDashboardStatsCardDetails(
    @Args('vendorId', { type: () => String }) vendorId: string,
    @Args('starting_date', { type: () => String }) starting_date: string,
    @Args('ending_date', { type: () => String }) ending_date: string,
    @Args('dateKeyword', { type: () => String, nullable: true })
    dateKeyword?: string,
  ) {
    return this.dashboardService.getVendorDashboardStatsCardDetails(
      vendorId,
      dateKeyword,
      starting_date,
      ending_date,
    );
  }

  @Query(() => LiveMonitorDataModel, { name: 'getLiveMonitorData' })
  getLiveMonitorData(
    @Args('id', { type: () => String }) id: string,
    @Args('dateKeyword', { type: () => String, nullable: true })
    dateKeyword?: string,
    @Args('starting_date', { type: () => String, nullable: true })
    starting_date?: string,
    @Args('ending_date', { type: () => String, nullable: true })
    ending_date?: string,
  ) {
    return this.dashboardService.getLiveMonitorData(
      id,
      dateKeyword,
      starting_date,
      ending_date,
    );
  }

  @Query(() => VendorGrowthStatsModel, {
    name: 'getVendorDashboardGrowthDetailsByYear',
  })
  getVendorDashboardGrowthDetailsByYear(
    @Args('vendorId', { type: () => String }) vendorId: string,
    @Args('year', { type: () => Int }) year: number,
  ) {
    return this.dashboardService.getVendorDashboardGrowthDetailsByYear(
      vendorId,
      year,
    );
  }
}
