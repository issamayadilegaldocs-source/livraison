import { gql } from "@apollo/client";

export const ORDER_RIDER_LOCATION_UPDATED = gql`
  subscription OrderRiderLocationUpdated($orderId: ID!) {
    orderRiderLocationUpdated(orderId: $orderId) {
      orderId
      latitude
      longitude
      receivedAt
      updateId
    }
  }
`;
