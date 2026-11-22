import { gql } from "@apollo/client";

export const ORDERS = gql`
  query Orders($page: Int, $limit: Int) {
    orders(page: $page, limit: $limit) {
      _id
      orderId
      id
      restaurant {
        _id
        name
        slug
        shopType
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
        id
      }
      items {
        _id
        id
        title
        food
        description
        quantity
        image
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
          title
          description
          quantityMinimum
          quantityMaximum
        }
      }
      user {
        _id
        name
        phone
      }
      rider {
        _id
        name
        phone
      }
      review {
        _id
        rating
      }
      paymentMethod
      paidAmount
      orderAmount
      orderStatus
      paymentStatus
      tipping
      taxationAmount
      serviceFee
      createdAt
      completionTime
      preparationTime
      orderDate
      expectedTime
      isPickedUp
      deliveryCharges
      acceptedAt
      pickedAt
      arrivedAt
      deliveredAt
      cancelledAt
      assignedAt
      instructions
      isExpress
      scheduledFor
      loyaltyDiscount
      orderAmountMoney { currency amount scale minorUnits }
      paidAmountMoney { currency amount scale minorUnits }
      deliveryChargesMoney { currency amount scale minorUnits }
      tippingMoney { currency amount scale minorUnits }
      taxationAmountMoney { currency amount scale minorUnits }
      discountAmountMoney { currency amount scale minorUnits }
      loyaltyDiscountMoney { currency amount scale minorUnits }
      expressSurchargeMoney { currency amount scale minorUnits }
      serviceFeeMoney { currency amount scale minorUnits }
    }
  }
`;


export const GET_USERS_PAST_ORDERS = gql`
  query GetUsersPastOrders($page: Int!, $limit: Int!, $offset: Int!) {
    getUsersPastOrders(page: $page, limit: $limit, offset: $offset) {
     _id
      orderId
      id
      restaurant {
        _id
        name
        slug
        shopType
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
        id
      }
      items {
        _id
        id
        title
        food
        description
        quantity
        image
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
          title
          description
          quantityMinimum
          quantityMaximum
        }
      }
      user {
        _id
        name
        phone
      }
      rider {
        _id
        name
        phone
      }
      review {
        _id
        rating
      }
      paymentMethod
      paidAmount
      orderAmount
      orderStatus
      paymentStatus
      tipping
      taxationAmount
      serviceFee
      createdAt
      completionTime
      preparationTime
      orderDate
      expectedTime
      isPickedUp
      deliveryCharges
      acceptedAt
      pickedAt
      arrivedAt
      deliveredAt
      cancelledAt
      assignedAt
      instructions
      isExpress
      scheduledFor
      loyaltyDiscount
      orderAmountMoney { currency amount scale minorUnits }
      paidAmountMoney { currency amount scale minorUnits }
      deliveryChargesMoney { currency amount scale minorUnits }
      tippingMoney { currency amount scale minorUnits }
      taxationAmountMoney { currency amount scale minorUnits }
      discountAmountMoney { currency amount scale minorUnits }
      loyaltyDiscountMoney { currency amount scale minorUnits }
      expressSurchargeMoney { currency amount scale minorUnits }
      serviceFeeMoney { currency amount scale minorUnits }
    }
  }
`;

export const GET_USERS_ACTIVE_ORDERS = gql`
  query GetUsersActiveOrders($page: Int!, $limit: Int!, $offset: Int!) {
    getUsersActiveOrders(page: $page, limit: $limit, offset: $offset) {
    _id
      orderId
      id
      restaurant {
        _id
        name
        slug
        shopType
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
        id
      }
      items {
        _id
        id
        title
        food
        description
        quantity
        image
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
          title
          description
          quantityMinimum
          quantityMaximum
        }
      }
      user {
        _id
        name
        phone
      }
      rider {
        _id
        name
        phone
      }
      review {
        _id
        rating
      }
      paymentMethod
      paidAmount
      orderAmount
      orderStatus
      paymentStatus
      tipping
      taxationAmount
      serviceFee
      createdAt
      completionTime
      preparationTime
      orderDate
      expectedTime
      isPickedUp
      deliveryCharges
      acceptedAt
      pickedAt
      arrivedAt
      deliveredAt
      cancelledAt
      assignedAt
      instructions
      loyaltyDiscount
      orderAmountMoney { currency amount scale minorUnits }
      paidAmountMoney { currency amount scale minorUnits }
      deliveryChargesMoney { currency amount scale minorUnits }
      tippingMoney { currency amount scale minorUnits }
      taxationAmountMoney { currency amount scale minorUnits }
      discountAmountMoney { currency amount scale minorUnits }
      loyaltyDiscountMoney { currency amount scale minorUnits }
      expressSurchargeMoney { currency amount scale minorUnits }
      serviceFeeMoney { currency amount scale minorUnits }
    }
  }
`;