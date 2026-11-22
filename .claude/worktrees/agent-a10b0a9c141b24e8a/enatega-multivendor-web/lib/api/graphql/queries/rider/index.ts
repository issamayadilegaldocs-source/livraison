import { gql } from "@apollo/client";

export const ORDER_RIDER_LOCATION = gql`
  query OrderRiderLocation($orderId: ID!) {
    orderRiderLocation(orderId: $orderId) {
      orderId
      latitude
      longitude
      receivedAt
      updateId
    }
  }
`;
