export const ORDER_STATS_PORT = Symbol('ORDER_STATS_PORT');

/**
 * Narrow, Orders-owned read interface over order activity, exposed so other
 * domains (e.g. Restaurants discovery/ranking and referential-integrity guards)
 * can read order-derived stats without registering or injecting the Order
 * Mongoose model. Mirrors the `ORDER_EARNINGS_PORT` / `ORDER_PAYMENT_PORT`
 * pattern: plain DTOs only, never Mongoose documents.
 */
export interface OrderStatsPort {
  /**
   * Last order timestamp (epoch ms) per restaurant, for the given restaurant
   * ids. Restaurants with no orders are omitted from the result.
   */
  lastOrderTimestamps(
    restaurantIds: string[],
  ): Promise<Array<{ restaurantId: string; lastOrderAt: number }>>;

  /**
   * Total order count per restaurant, for the given restaurant ids.
   * Restaurants with no orders are omitted from the result.
   */
  orderCounts(
    restaurantIds: string[],
  ): Promise<Array<{ restaurantId: string; count: number }>>;

  /** Total number of orders referencing a single restaurant. */
  countOrdersForRestaurant(restaurantId: string): Promise<number>;
}
