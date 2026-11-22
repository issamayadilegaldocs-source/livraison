import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument } from '../orders/order.schema';
import { Restaurant, RestaurantDocument } from '../restaurants/restaurant.schema';
import { User, UserDocument } from '../users/user.schema';
import { Rider, RiderDocument } from '../riders/rider.schema';
import { Owner, OwnerDocument } from '../owners/owner.schema';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Restaurant.name)
    private readonly restaurantModel: Model<RestaurantDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Rider.name) private readonly riderModel: Model<RiderDocument>,
    @InjectModel(Owner.name) private readonly ownerModel: Model<OwnerDocument>,
  ) {}

  // ── helpers ───────────────────────────────────────────────────────────────

  private buildDateRange(
    startingDate?: string,
    endingDate?: string,
    dateKeyword?: string,
  ): { from: Date; to: Date } | null {
    if (dateKeyword) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const DAY = 86_400_000;
      switch (dateKeyword.toLowerCase()) {
        case 'today':
          return { from: today, to: new Date(today.getTime() + DAY) };
        case 'yesterday': {
          const y = new Date(today.getTime() - DAY);
          return { from: y, to: today };
        }
        case 'week':
        case 'this week':
        case 'weekly': {
          const monday = new Date(today.getTime() - today.getDay() * DAY);
          return { from: monday, to: now };
        }
        case 'month':
        case 'this month':
        case 'monthly':
          return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
        case 'year':
        case 'this year':
        case 'yearly':
          return { from: new Date(now.getFullYear(), 0, 1), to: now };
      }
    }
    if (startingDate || endingDate) {
      return {
        from: startingDate ? new Date(startingDate) : new Date(0),
        to: endingDate ? new Date(endingDate) : new Date(),
      };
    }
    return null;
  }

  private pct(curr: number, prev: number): number {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 10_000) / 100;
  }

  // ── super-admin ───────────────────────────────────────────────────────────

  async getDashboardUsers() {
    const [usersCount, vendorsCount, restaurantsCount, ridersCount] =
      await Promise.all([
        this.userModel.countDocuments(),
        this.ownerModel.countDocuments({ userType: 'VENDOR' }),
        this.restaurantModel.countDocuments(),
        this.riderModel.countDocuments(),
      ]);
    return { usersCount, vendorsCount, restaurantsCount, ridersCount };
  }

  async getDashboardUsersByYear(year: number) {
    const y0 = new Date(year, 0, 1);
    const y1 = new Date(year + 1, 0, 1);
    const yp = new Date(year - 1, 0, 1);

    const cnt = (model: Model<any>, q: any, from: Date, to: Date) =>
      model.countDocuments({ ...q, createdAt: { $gte: from, $lt: to } });

    const [uc1, vc1, rc1, ri1, uc0, vc0, rc0, ri0] = await Promise.all([
      cnt(this.userModel, {}, y0, y1),
      cnt(this.ownerModel, { userType: 'VENDOR' }, y0, y1),
      cnt(this.restaurantModel, {}, y0, y1),
      cnt(this.riderModel, {}, y0, y1),
      cnt(this.userModel, {}, yp, y0),
      cnt(this.ownerModel, { userType: 'VENDOR' }, yp, y0),
      cnt(this.restaurantModel, {}, yp, y0),
      cnt(this.riderModel, {}, yp, y0),
    ]);

    return {
      usersCount: uc1,
      vendorsCount: vc1,
      restaurantsCount: rc1,
      ridersCount: ri1,
      percentageChange: {
        usersPercent: this.pct(uc1, uc0),
        vendorsPercent: this.pct(vc1, vc0),
        restaurantsPercent: this.pct(rc1, rc0),
        ridersPercent: this.pct(ri1, ri0),
      },
    };
  }

  async getDashboardOrdersByType() {
    return this.orderModel.aggregate([
      {
        $group: {
          _id: { $cond: [{ $eq: ['$isPickedUp', true] }, 'PICKUP', 'DELIVERY'] },
          value: { $sum: 1 },
        },
      },
      { $project: { _id: 0, label: '$_id', value: 1 } },
    ]);
  }

  async getDashboardSalesByType() {
    return this.orderModel.aggregate([
      {
        $group: {
          _id: { $cond: [{ $eq: ['$isPickedUp', true] }, 'PICKUP', 'DELIVERY'] },
          value: { $sum: '$orderAmount' },
        },
      },
      { $project: { _id: 0, label: '$_id', value: 1 } },
    ]);
  }

  // ── restaurant dashboard ──────────────────────────────────────────────────

  async getRestaurantDashboardOrdersSalesStats(
    restaurantId: string,
    startingDate: string,
    endingDate: string,
    dateKeyword?: string,
  ) {
    const range = this.buildDateRange(startingDate, endingDate, dateKeyword);
    const match: any = { restaurant: new Types.ObjectId(restaurantId) };
    if (range) match.createdAt = { $gte: range.from, $lte: range.to };

    const [result] = await this.orderModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSales: { $sum: '$orderAmount' },
          totalCODOrders: {
            $sum: { $cond: [{ $eq: ['$paymentMethod', 'COD'] }, 1, 0] },
          },
          totalCardOrders: {
            $sum: { $cond: [{ $ne: ['$paymentMethod', 'COD'] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          totalOrders: 1,
          totalSales: 1,
          totalCODOrders: 1,
          totalCardOrders: 1,
        },
      },
    ]);
    return (
      result ?? {
        totalOrders: 0,
        totalSales: 0,
        totalCODOrders: 0,
        totalCardOrders: 0,
      }
    );
  }

  async getRestaurantDashboardSalesOrderCountDetailsByYear(
    restaurantId: string,
    year: number,
  ) {
    const from = new Date(year, 0, 1);
    const to = new Date(year + 1, 0, 1);

    const results = await this.orderModel.aggregate([
      {
        $match: {
          restaurant: new Types.ObjectId(restaurantId),
          createdAt: { $gte: from, $lt: to },
        },
      },
      {
        $group: {
          _id: { $month: '$createdAt' },
          sales: { $sum: '$orderAmount' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const salesAmount: number[] = Array(12).fill(0);
    const ordersCount: number[] = Array(12).fill(0);
    results.forEach((r: any) => {
      salesAmount[r._id - 1] = r.sales;
      ordersCount[r._id - 1] = r.orders;
    });
    return { salesAmount, ordersCount };
  }

  async getDashboardOrderSalesDetailsByPaymentMethod(
    restaurantId: string,
    startingDate: string,
    endingDate: string,
  ) {
    const from = new Date(startingDate);
    const to = new Date(endingDate);
    const base: any = {
      restaurant: new Types.ObjectId(restaurantId),
      createdAt: { $gte: from, $lte: to },
    };

    const agg = async (extra?: any) => {
      const [r] = await this.orderModel.aggregate([
        { $match: { ...base, ...extra } },
        {
          $group: {
            _id: null,
            total_orders: { $sum: 1 },
            total_sales: { $sum: '$orderAmount' },
            total_delivery_fee: { $sum: '$deliveryCharges' },
          },
        },
        {
          $project: {
            _id: 0,
            total_orders: 1,
            total_sales: 1,
            total_delivery_fee: 1,
            total_sales_without_delivery: {
              $subtract: ['$total_sales', '$total_delivery_fee'],
            },
          },
        },
      ]);
      return (
        r ?? {
          total_orders: 0,
          total_sales: 0,
          total_delivery_fee: 0,
          total_sales_without_delivery: 0,
        }
      );
    };

    const [allData, codData, cardData] = await Promise.all([
      agg(),
      agg({ paymentMethod: 'COD' }),
      agg({ paymentMethod: { $ne: 'COD' } }),
    ]);

    return {
      all: { _type: 'ALL', data: allData },
      cod: { _type: 'COD', data: codData },
      card: { _type: 'CARD', data: cardData },
    };
  }

  // ── vendor dashboard ──────────────────────────────────────────────────────

  private async vendorRestaurantIds(vendorId: string): Promise<Types.ObjectId[]> {
    const owner = await this.ownerModel
      .findById(vendorId)
      .select('restaurants')
      .lean()
      .exec();
    return ((owner as any)?.restaurants ?? []).map(
      (id: any) => new Types.ObjectId(id),
    );
  }

  async getStoreDetailsByVendorId(
    vendorId: string,
    dateKeyword?: string,
    startingDate?: string,
    endingDate?: string,
  ) {
    const restaurantIds = await this.vendorRestaurantIds(vendorId);
    if (!restaurantIds.length) return [];

    const range = this.buildDateRange(startingDate, endingDate, dateKeyword);
    const match: any = { restaurant: { $in: restaurantIds } };
    if (range) match.createdAt = { $gte: range.from, $lte: range.to };

    const [results, restaurants] = await Promise.all([
      this.orderModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$restaurant',
            totalOrders: { $sum: 1 },
            totalSales: { $sum: '$orderAmount' },
            pickUpCount: { $sum: { $cond: ['$isPickedUp', 1, 0] } },
            deliveryCount: {
              $sum: { $cond: [{ $eq: ['$isPickedUp', true] }, 0, 1] },
            },
          },
        },
      ]),
      this.restaurantModel
        .find({ _id: { $in: restaurantIds } })
        .select('_id name')
        .lean()
        .exec(),
    ]);

    const nameMap = new Map(
      (restaurants as any[]).map((r) => [r._id.toString(), r.name]),
    );

    return results.map((r: any) => ({
      _id: r._id.toString(),
      totalOrders: r.totalOrders,
      totalSales: r.totalSales,
      pickUpCount: r.pickUpCount,
      deliveryCount: r.deliveryCount,
      restaurantName: nameMap.get(r._id.toString()) ?? '',
    }));
  }

  async getVendorDashboardStatsCardDetails(
    vendorId: string,
    dateKeyword?: string,
    startingDate?: string,
    endingDate?: string,
  ) {
    const restaurantIds = await this.vendorRestaurantIds(vendorId);
    const totalRestaurants = restaurantIds.length;
    if (!totalRestaurants)
      return {
        totalRestaurants: 0,
        totalOrders: 0,
        totalSales: 0,
        totalDeliveries: 0,
      };

    const range = this.buildDateRange(startingDate, endingDate, dateKeyword);
    const match: any = { restaurant: { $in: restaurantIds } };
    if (range) match.createdAt = { $gte: range.from, $lte: range.to };

    const [result] = await this.orderModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSales: { $sum: '$orderAmount' },
          totalDeliveries: {
            $sum: { $cond: [{ $eq: ['$isPickedUp', true] }, 0, 1] },
          },
        },
      },
    ]);

    return {
      totalRestaurants,
      totalOrders: result?.totalOrders ?? 0,
      totalSales: result?.totalSales ?? 0,
      totalDeliveries: result?.totalDeliveries ?? 0,
    };
  }

  async getLiveMonitorData(
    vendorId: string,
    dateKeyword?: string,
    startingDate?: string,
    endingDate?: string,
  ) {
    const restaurantIds = await this.vendorRestaurantIds(vendorId);
    if (!restaurantIds.length)
      return {
        online_stores: 0,
        cancelled_orders: 0,
        delayed_orders: 0,
        ratings: 0,
      };

    const range = this.buildDateRange(startingDate, endingDate, dateKeyword);
    const orderMatch: any = { restaurant: { $in: restaurantIds } };
    if (range) orderMatch.createdAt = { $gte: range.from, $lte: range.to };

    const [online_stores, cancelled_orders, delayed_orders] =
      await Promise.all([
        this.restaurantModel.countDocuments({
          _id: { $in: restaurantIds },
          isActive: true,
          isAvailable: true,
        }),
        this.orderModel.countDocuments({
          ...orderMatch,
          orderStatus: 'CANCELLED',
        }),
        this.orderModel.countDocuments({
          ...orderMatch,
          orderStatus: { $in: ['ACCEPTED', 'ASSIGNED', 'PICKED', 'ARRIVED'] },
        }),
      ]);

    return { online_stores, cancelled_orders, delayed_orders, ratings: 0 };
  }

  async getVendorDashboardGrowthDetailsByYear(vendorId: string, year: number) {
    const restaurantIds = await this.vendorRestaurantIds(vendorId);
    const empty = {
      totalRestaurants: Array(12).fill(0) as number[],
      totalOrders: Array(12).fill(0) as number[],
      totalSales: Array(12).fill(0) as number[],
    };
    if (!restaurantIds.length) return empty;

    const from = new Date(year, 0, 1);
    const to = new Date(year + 1, 0, 1);

    const [orderResults, restaurantResults] = await Promise.all([
      this.orderModel.aggregate([
        {
          $match: {
            restaurant: { $in: restaurantIds },
            createdAt: { $gte: from, $lt: to },
          },
        },
        {
          $group: {
            _id: { $month: '$createdAt' },
            orders: { $sum: 1 },
            sales: { $sum: '$orderAmount' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      this.restaurantModel.aggregate([
        {
          $match: {
            _id: { $in: restaurantIds },
            createdAt: { $gte: from, $lt: to },
          },
        },
        {
          $group: { _id: { $month: '$createdAt' }, count: { $sum: 1 } },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const totalOrders: number[] = Array(12).fill(0);
    const totalSales: number[] = Array(12).fill(0);
    const totalRestaurants: number[] = Array(12).fill(0);

    orderResults.forEach((r: any) => {
      totalOrders[r._id - 1] = r.orders;
      totalSales[r._id - 1] = r.sales;
    });
    restaurantResults.forEach((r: any) => {
      totalRestaurants[r._id - 1] = r.count;
    });

    return { totalRestaurants, totalOrders, totalSales };
  }
}
