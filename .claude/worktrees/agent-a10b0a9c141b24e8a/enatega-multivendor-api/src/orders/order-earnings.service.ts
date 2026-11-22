import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument } from './order.schema';
import {
  AdminEarningsResult,
  DeliveredEarningRow,
  EarningDayBucket,
  OrderEarningsFilter,
  OrderEarningsPort,
  StoreEarningDayBucket,
} from './order-earnings.port';

@Injectable()
export class OrderEarningsService implements OrderEarningsPort {
  constructor(@InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>) {}

  async findRiderEarningsByDate(filter: OrderEarningsFilter): Promise<{
    totalCount: number;
    days: EarningDayBucket[];
  }> {
    const query = this.buildDeliveredQuery(filter);
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 10;
    const orders = await this.orderModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .exec();

    const days = this.groupRowsByDate((orders as any[]).map((order) => this.toRow(order)));
    return { totalCount: days.length, days };
  }

  async sumRiderEarnings(filter: OrderEarningsFilter): Promise<number> {
    const query = this.buildDeliveredQuery(filter);
    const orders = await this.orderModel.find(query).lean().exec();
    // The rider's grand total is the FULL payout per order — delivery commission
    // + 100% of the tip + the platform-funded bonus — matching the per-day graph
    // (riderEarningsGraph). riderEarningsOf is commission-only (the bonus is
    // subtracted back out there), so add tip and bonus explicitly here.
    return (orders as any[]).reduce(
      (sum, order) =>
        sum +
        this.riderEarningsOf(order) +
        (order.tipping ?? 0) +
        (order.deliveryBonus ?? 0),
      0,
    );
  }

  async findStoreEarningsByDate(filter: OrderEarningsFilter): Promise<{
    totalCount: number;
    days: StoreEarningDayBucket[];
  }> {
    const query = this.buildDeliveredQuery(filter);
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 10;
    const dateExpression = {
      $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
    };
    const skip = (page - 1) * limit;

    // The store's commission base is the ORIGINAL subtotal. Legacy orders (no
    // persisted subtotal) fall back to the discounted food actually collected
    // (orderAmount minus the non-food lines) — mirroring computeEarningsSplit so
    // the graph and the admin split agree.
    const storeBaseExpression = {
      $let: {
        vars: {
          sub: { $ifNull: ['$subtotal', 0] },
          netFood: {
            $subtract: [
              { $ifNull: ['$orderAmount', 0] },
              {
                $add: [
                  { $ifNull: ['$deliveryCharges', 0] },
                  { $ifNull: ['$tipping', 0] },
                  { $ifNull: ['$taxationAmount', 0] },
                  { $ifNull: ['$expressSurcharge', 0] },
                  { $ifNull: ['$serviceFee', 0] },
                ],
              },
            ],
          },
        },
        in: {
          $cond: [{ $gt: ['$$sub', 0] }, '$$sub', { $max: [0, '$$netFood'] }],
        },
      },
    };

    const [groups, countResult] = await Promise.all([
      this.orderModel
        .aggregate([
          { $match: query },
          { $sort: { createdAt: -1 } },
          {
            $group: {
              _id: dateExpression,
              totalOrderAmount: { $sum: { $ifNull: ['$orderAmount', 0] } },
              totalStoreBase: { $sum: storeBaseExpression },
              totalDeliveries: { $sum: 1 },
              earningsArray: {
                $push: {
                  totalOrderAmount: { $ifNull: ['$orderAmount', 0] },
                  storeBase: storeBaseExpression,
                  orderDetails: {
                    orderId: '$orderId',
                    orderType: { $cond: ['$isPickedUp', 'PICK_UP', 'DELIVERY'] },
                    paymentMethod: '$paymentMethod',
                  },
                },
              },
            },
          },
          { $sort: { _id: -1 } },
          { $skip: skip },
          { $limit: limit },
        ])
        .exec(),
      this.orderModel
        .aggregate([{ $match: query }, { $group: { _id: dateExpression } }, { $count: 'totalCount' }])
        .exec(),
    ]);

    return {
      totalCount: countResult[0]?.totalCount ?? 0,
      days: (groups as any[]).map((group) => ({
        date: group._id,
        totalOrderAmount: group.totalOrderAmount ?? 0,
        totalStoreBase: group.totalStoreBase ?? 0,
        totalDeliveries: group.totalDeliveries ?? 0,
        entries: group.earningsArray ?? [],
      })),
    };
  }

  async findStoreOrders(filter: OrderEarningsFilter): Promise<DeliveredEarningRow[]> {
    const query = this.buildDeliveredQuery(filter);
    const orders = await this.orderModel.find(query).lean().exec();
    return (orders as any[]).map((order) => this.toRow(order));
  }

  async findAdminEarnings(filter: OrderEarningsFilter): Promise<AdminEarningsResult> {
    const query = this.buildDeliveredQuery(filter);
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 10;
    const [pageOrders, allOrders, totalCount] = await Promise.all([
      this.orderModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('rider', '_id name username')
        .populate('restaurant', '_id name username commissionRate')
        .lean()
        .exec(),
      this.orderModel
        .find(
          query,
          'orderAmount orderAmountScale subtotal deliveryCharges tipping taxationAmount expressSurcharge serviceFee deliveryBonus restaurant riderEarnings riderCommission',
        )
        .populate('restaurant', 'commissionRate')
        .lean()
        .exec(),
      this.orderModel.countDocuments(query).exec(),
    ]);

    return {
      totalCount,
      page: (pageOrders as any[]).map((order) => this.toRow(order)),
      all: (allOrders as any[]).map((order) => this.toRow(order)),
    };
  }

  private buildDeliveredQuery(filter: OrderEarningsFilter): Record<string, unknown> {
    const query: Record<string, unknown> = { orderStatus: 'DELIVERED' };
    if (filter.riderId) query.rider = new Types.ObjectId(filter.riderId);
    if (filter.restaurantId) query.restaurant = new Types.ObjectId(filter.restaurantId);
    if (filter.orderType === 'DELIVERY') query.isPickedUp = false;
    if (filter.orderType === 'PICK_UP') query.isPickedUp = true;
    if (filter.paymentMethod) query.paymentMethod = filter.paymentMethod;
    if (filter.search) query.orderId = { $regex: filter.search, $options: 'i' };
    this.applyDateFilter(query, filter.startDate, filter.endDate);
    return query;
  }

  private applyDateFilter(query: Record<string, unknown>, startDate?: string, endDate?: string) {
    if (!startDate && !endDate) return;
    const createdAt: Record<string, Date> = {};
    if (startDate) createdAt.$gte = new Date(startDate);
    if (endDate) createdAt.$lte = new Date(endDate);
    query.createdAt = createdAt;
  }

  private groupRowsByDate(rows: DeliveredEarningRow[]): EarningDayBucket[] {
    const map = new Map<string, DeliveredEarningRow[]>();
    for (const row of rows) {
      const date = new Date(row.createdAt ?? '').toISOString().split('T')[0];
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(row);
    }
    return Array.from(map.entries()).map(([date, orders]) => ({ date, orders }));
  }

  private toRow(order: any): DeliveredEarningRow {
    return {
      id: String(order._id),
      orderId: order.orderId,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      orderAmount: order.orderAmount ?? 0,
      orderAmountScale: order.orderAmountScale,
      subtotal: order.subtotal ?? 0,
      deliveryCharges: order.deliveryCharges ?? 0,
      taxationAmount: order.taxationAmount ?? 0,
      tipping: order.tipping ?? 0,
      expressSurcharge: order.expressSurcharge ?? 0,
      serviceFee: order.serviceFee ?? 0,
      deliveryBonus: order.deliveryBonus ?? 0,
      riderEarnings: this.riderEarningsOf(order),
      isPickedUp: order.isPickedUp ?? false,
      paymentMethod: order.paymentMethod,
      rider: this.toUserRef(order.rider),
      restaurant: this.toUserRef(order.restaurant),
    };
  }

  // The rider's DELIVERY COMMISSION portion (excluding the bonus), used as the
  // split's `riderEarnings` input. `riderCommission` (frozen at PREPARED) is
  // commission-only. `riderEarnings` (credited at DELIVERED) now bundles the
  // bonus, so subtract it back out to avoid double-counting the bonus, which the
  // split adds separately.
  private riderEarningsOf(order: any): number {
    if (order.riderEarnings != null) {
      return Math.max(0, order.riderEarnings - (order.deliveryBonus ?? 0));
    }
    return order.riderCommission ?? 0;
  }

  private toUserRef(ref: any) {
    if (!ref || typeof ref !== 'object') return undefined;
    return {
      id: String(ref._id ?? ref.id),
      name: ref.name,
      username: ref.username,
      commissionRate: ref.commissionRate,
    };
  }
}
