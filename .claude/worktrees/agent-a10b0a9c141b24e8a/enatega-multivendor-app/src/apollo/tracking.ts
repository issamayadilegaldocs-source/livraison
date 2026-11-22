import { gql } from '@apollo/client'

export const ORDER_RIDER_LOCATION = gql`
  query OrderRiderLocation($orderId: ID!) {
    orderRiderLocation(orderId: $orderId) {
      orderId
      latitude
      longitude
      accuracyMeters
      headingDegrees
      speedMetersPerSecond
      capturedAt
      receivedAt
      updateId
    }
  }
`

export const ORDER_RIDER_LOCATION_UPDATED = gql`
  subscription OrderRiderLocationUpdated($orderId: ID!) {
    orderRiderLocationUpdated(orderId: $orderId) {
      orderId
      latitude
      longitude
      accuracyMeters
      headingDegrees
      speedMetersPerSecond
      capturedAt
      receivedAt
      updateId
    }
  }
`
