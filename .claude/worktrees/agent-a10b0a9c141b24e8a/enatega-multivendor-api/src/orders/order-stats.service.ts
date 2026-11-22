import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument } from './order.schema';
import { Review, ReviewDocument } from './review.schema';
import { OrderStatsPort } from './order-stats.port';
import {
  RestaurantReviewRowDto,
  RestaurantReviewsPort,
  RestaurantReviewsResult,
} from './restaurant-reviews.port';

/**
 * Implements the Orders-owned read ports over orders and reviews. This is the
 * single place that injects the `Order` and `Review` Mongoose models on behalf
 * of cross-domain consumers (Restaurants discovery/ranking and the hard-delete
 * referential-integrity guard), so those domains no longer reach into the
 * Orders collections directly.
 */
@Injectable()
export class OrderStatsService implements OrderStatsPort, RestaurantReviewsPort {
  constructor(
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Review.name)
    private readonly reviewModel: Model<ReviewDocument>,
  ) {}

  async lastOrderTimestamps(
    restaurantIds: string[],
  ): Promise<Array<{ restaurantId: string; lastOrderAt: number }>> {
    if (!restaurantIds.length) return [];
    const ids = restaurantIds.map((id) => new Types.ObjectId(id));
    const recent = await this.orderModel.aggregate<{
      _id: Types.ObjectId;
      lastOrder: Date;
    }>([
      { $match: { restaurant: { $in: ids } } },
      { $group: { _id: '$restaurant', lastOrder: { $max: '$createdAt' } } },
    ]);
    return recent.map((r) => ({
      restaurantId: String(r._id),
      lastOrderAt: r.lastOrder ? new Date(r.lastOrder).getTime() : 0,
    }));
  }

  async orderCounts(
    restaurantIds: string[],
  ): Promise<Array<{ restaurantId: string; count: number }>> {
    if (!restaurantIds.length) return [];
    const ids = restaurantIds.map((id) => new Types.ObjectId(id));
    const counts = await this.orderModel.aggregate<{
      _id: Types.ObjectId;
      count: number;
    }>([
      { $match: { restaurant: { $in: ids } } },
      { $group: { _id: '$restaurant', count: { $sum: 1 } } },
    ]);
    return counts.map((c) => ({ restaurantId: String(c._id), count: c.count }));
  }

  async countOrdersForRestaurant(restaurantId: string): Promise<number> {
    return this.orderModel
      .countDocuments({ restaurant: new Types.ObjectId(restaurantId) })
      .exec();
  }

  async reviewsByRestaurant(restaurantId: string): Promise<RestaurantReviewsResult> {
    const reviews = await this.reviewModel
      .find({ restaurant: new Types.ObjectId(restaurantId), isActive: true })
      .populate({
        path: 'order',
        select: '_id user',
        populate: { path: 'user', select: '_id name email' },
      })
      .populate({ path: 'restaurant', select: '_id name' })
      .lean()
      .exec();

    const total = reviews.length;
    const ratings =
      total > 0
        ? reviews.reduce((sum, r) => sum + (r.rating ?? 0), 0) / total
        : null;

    // Map to plain DTOs (ObjectId → string) so no Mongoose-shaped document
    // leaks across the module boundary.
    const rows: RestaurantReviewRowDto[] = reviews.map((r: any) => ({
      _id: r._id ? String(r._id) : undefined,
      rating: r.rating,
      comments: r.comments,
      description: r.description,
      createdAt: r.createdAt,
      order: r.order
        ? {
            _id: r.order._id ? String(r.order._id) : undefined,
            user: r.order.user
              ? {
                  _id: r.order.user._id ? String(r.order.user._id) : undefined,
                  name: r.order.user.name,
                  email: r.order.user.email,
                }
              : undefined,
          }
        : undefined,
      restaurant: r.restaurant
        ? {
            _id: r.restaurant._id ? String(r.restaurant._id) : undefined,
            name: r.restaurant.name,
          }
        : undefined,
    }));

    return { reviews: rows, ratings, total };
  }
}
