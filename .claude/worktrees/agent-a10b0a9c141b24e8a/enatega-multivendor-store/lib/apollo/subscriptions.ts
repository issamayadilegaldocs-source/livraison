import { gql } from "@apollo/client";

export const SUBSCRIPTION_NEW_MESSAGE = gql`
  subscription SubscriptionNewMessage($order: String!) {
    subscriptionNewMessage(order: $order) {
      id
      message
      user {
        id
        name
      }
      createdAt
    }
  }
`;

export const SUBSCRIBE_RESTAURANT_ORDER_STATUS = gql`
  subscription SubscribeRestaurantOrderStatus($restaurantId: String!) {
    subscriptionRestaurantOrderStatus(restaurantId: $restaurantId) {
      _id
      orderStatus
      preparationTime
      acceptedAt
      pickedAt
      deliveredAt
      cancelledAt
      assignedAt
      reason
      isRinged
      rider {
        _id
        name
        username
        available
      }
    }
  }
`;

export const SUBSCRIBE_PLACE_ORDER = gql`
  subscription SubscribePlaceOrder($restaurant: String!) {
    subscribePlaceOrder(restaurant: $restaurant) {
      userId
      origin
      order {
        _id
        orderId
        id
        restaurant {
          _id
          name
          image
          address
          location {
            coordinates
          }
        }
        deliveryAddress {
          location {
            coordinates
          }
          deliveryAddress
          details
          label
        }
        items {
          _id
          id
          title
          description
          image
          quantity
          variation {
            _id
            id
            title
            price
            discounted
          }
          addons {
            _id
            id
            options {
              _id
              id
              title
              description
              price
            }
            description
            title
            quantityMinimum
            quantityMaximum
          }
          specialInstructions
          isActive
          createdAt
          updatedAt
        }
        user {
          _id
          name
          phone
          email
        }
        paymentMethod
        paidAmount
        orderAmount
        orderStatus
        tipping
        taxationAmount
        status
        paymentStatus
        reason
        isActive
        createdAt
        orderDate
        pickedAt
        deliveryCharges
        isPickedUp
        preparationTime
        acceptedAt
        isRinged
        instructions
        rider {
          _id
          name
          username
          available
        }
        discountAmount
        isExpress
        scheduledFor
        loyaltyDiscount
      }
    }
  }
`;
