export const RESTAURANT_REVIEWS_PORT = Symbol('RESTAURANT_REVIEWS_PORT');

export interface RestaurantReviewOrderUserDto {
  _id?: string;
  name?: string;
  email?: string;
}

export interface RestaurantReviewOrderDto {
  _id?: string;
  user?: RestaurantReviewOrderUserDto;
}

export interface RestaurantReviewRestaurantDto {
  _id?: string;
  name?: string;
}

export interface RestaurantReviewRowDto {
  _id?: string;
  rating?: number;
  comments?: string;
  description?: string;
  createdAt?: Date;
  order?: RestaurantReviewOrderDto;
  restaurant?: RestaurantReviewRestaurantDto;
}

export interface RestaurantReviewsResult {
  reviews: RestaurantReviewRowDto[];
  ratings: number | null;
  total: number;
}

/**
 * Orders-owned read interface over restaurant reviews (the `reviews` collection
 * lives in the Orders domain). Kept semantically separate from `OrderStatsPort`
 * so a review read does not pull in order-stat aggregations. Returns plain DTOs,
 * never Mongoose documents.
 */
export interface RestaurantReviewsPort {
  reviewsByRestaurant(restaurantId: string): Promise<RestaurantReviewsResult>;
}
