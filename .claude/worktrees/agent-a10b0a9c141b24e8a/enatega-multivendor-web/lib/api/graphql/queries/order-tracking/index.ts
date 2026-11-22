import { gql } from "@apollo/client";

export const ORDER_TRACKING = gql`query OrderDetails($orderDetailsId: String!) {
  orderDetails: order(id: $orderDetailsId) {
   _id
    orderId
    restaurant {
      _id
      name
      image
      slug
      address
      location {
        coordinates
        __typename
      }
      __typename
    }
    deliveryAddress {
      location {
        coordinates
        __typename
      }
      deliveryAddress
      __typename
    }
    items {
      _id
      title
      food
      description
      quantity
      image
      variation {
        _id
        title
        price
        discounted
        __typename
      }
      addons {
        _id
        options {
          _id
          title
          description
          price
          __typename
        }
        title
        description
        quantityMinimum
        quantityMaximum
        __typename
      }
      __typename
    }
    user {
      _id
      name
      phone
      __typename
    }
    rider{
      _id
    }
    review {
      _id
    }
    paymentMethod
    paidAmount
    orderAmount
    discountAmount
    orderStatus
    deliveryCharges
    tipping
    taxationAmount
    serviceFee
    orderAmountMoney { currency amount scale minorUnits }
    paidAmountMoney { currency amount scale minorUnits }
    deliveryChargesMoney { currency amount scale minorUnits }
    tippingMoney { currency amount scale minorUnits }
    taxationAmountMoney { currency amount scale minorUnits }
    discountAmountMoney { currency amount scale minorUnits }
    loyaltyDiscountMoney { currency amount scale minorUnits }
    expressSurchargeMoney { currency amount scale minorUnits }
    serviceFeeMoney { currency amount scale minorUnits }
    orderDate
    expectedTime
    isPickedUp
    createdAt
    completionTime
    cancelledAt
    assignedAt
    deliveredAt
    acceptedAt
    pickedAt
    arrivedAt
    preparationTime
    instructions
    __typename
  }
}`;
