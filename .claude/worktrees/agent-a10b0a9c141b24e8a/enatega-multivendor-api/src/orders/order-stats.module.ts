import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from './order.schema';
import { Review, ReviewSchema } from './review.schema';
import { ORDER_STATS_PORT } from './order-stats.port';
import { RESTAURANT_REVIEWS_PORT } from './restaurant-reviews.port';
import { OrderStatsService } from './order-stats.service';

/**
 * Standalone Orders-owned read module that exposes order-stat and
 * restaurant-review query ports. It imports neither `OrdersModule` nor
 * `RestaurantsModule`, so `RestaurantsModule` → `OrderStatsModule` is a one-way
 * edge and the Restaurants↔Orders cycle is avoided (mirrors the
 * `PaymentAttemptsModule` precedent).
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Review.name, schema: ReviewSchema },
    ]),
  ],
  providers: [
    OrderStatsService,
    { provide: ORDER_STATS_PORT, useExisting: OrderStatsService },
    { provide: RESTAURANT_REVIEWS_PORT, useExisting: OrderStatsService },
  ],
  exports: [ORDER_STATS_PORT, RESTAURANT_REVIEWS_PORT],
})
export class OrderStatsModule {}
