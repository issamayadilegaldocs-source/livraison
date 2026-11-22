import { gql } from "@apollo/client";

export const VERIFY_COUPON = gql`
  mutation Coupon($coupon: String!, $restaurantId: ID!) {
    coupon: applyCoupon(coupon: $coupon, restaurantId: $restaurantId) {
      success
      message
      coupon {
        _id
        title
        discount
        enabled
      }
    }
  }
`;
