import { gql } from "@apollo/client";

export const MY_NOTIFICATIONS = gql`
  query MyNotifications {
    myNotifications {
      _id
      title
      body
      isRead
      createdAt
    }
  }
`;

export const FOOD_STOCK_CHANGED_SUBSCRIPTION = gql`
  subscription FoodStockChanged($restaurantId: String!) {
    foodStockChanged(restaurantId: $restaurantId) {
      restaurantId
      categoryId
      foodId
      isOutOfStock
    }
  }
`;
