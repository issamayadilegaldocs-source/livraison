import { gql } from "@apollo/client";

export const ASSIGN_ORDER = gql`
  mutation AssignOrder($id: String!) {
    assignOrder(id: $id) {
      _id
      orderStatus
      rider {
        _id
        name
        username
      }
    }
  }
`;

export const UPDATE_ORDER_STATUS_RIDER = gql`
  mutation UpdateOrderStatusRider($id: String!, $status: String!, $codCollected: Boolean) {
    updateOrderStatusRider(id: $id, status: $status, codCollected: $codCollected) {
      _id
      orderId
      orderStatus
      codCollectedAt
      isPickedUp
      acceptedAt
      pickedAt
      assignedAt
      deliveredAt
      expectedTime
      deliveryCharges
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
        label
        details
      }
      items {
        _id
        title
        food
        description
        image
        quantity
        variation {
          _id
          title
          price
        }
        addons {
          _id
          options {
            _id
            title
            price
          }
          title
          description
          quantityMinimum
          quantityMaximum
        }
        isActive
        createdAt
      }
      user {
        _id
        name
        phone
      }
      paymentMethod
      paidAmount
      orderAmount
      paymentStatus
      tipping
      taxationAmount
      reason
      isRiderRinged
      preparationTime
      riderDeliveredAt
      customerDeliveredAt
      riderCommission
      riderEarnings
      rider {
        _id
        name
        username
      }
    }
  }
`;

export const MARK_ORDER_ARRIVED = gql`
  mutation MarkOrderArrived($id: String!) {
    markOrderArrived(id: $id) {
      _id
      orderId
      orderStatus
      arrivedAt
      riderDeliveredAt
      customerDeliveredAt
    }
  }
`;

export const REJECT_RIDER_ASSIGNMENT = gql`
  mutation RejectRiderAssignment($id: String!) {
    rejectRiderAssignment(id: $id) {
      _id
      orderStatus
    }
  }
`;

export const cancelOrder = `#graphql
          mutation($abortOrderId: String!){
            abortOrder(id: $abortOrderId) {
              _id
              orderStatus
            }
          }`;

export const reviewOrder = gql`
  mutation ReviewOrder($order: String!, $rating: Int!, $description: String) {
    reviewOrder(
      reviewInput: { order: $order, rating: $rating, description: $description }
    ) {
      _id
      orderId
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
        id
      }
      items {
        _id
        title
        food
        description
        quantity
        variation {
          _id
          title
          price
          discounted
        }
        addons {
          _id
          options {
            _id
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
      }
      review {
        _id
      }
      paymentMethod
      paidAmount
      orderAmount
      orderStatus
      tipping
      taxationAmount
      createdAt
      completionTime
      preparationTime
      orderDate
      expectedTime
      isPickedUp
      deliveryCharges
      acceptedAt
      pickedAt
      deliveredAt
      cancelledAt
      assignedAt
    }
  }
`;

export const placeOrder = `#graphql 
  mutation PlaceOrder($restaurant:String!,$orderInput:[OrderItemInput!]!,$paymentMethod:String!,$couponCode:String,$tipping:Float!, $taxationAmount: Float!,$address:PlaceOrderAddressInput!, $orderDate: String!,$isPickedUp: Boolean!, $deliveryCharges: Float!, $instructions: String){
    placeOrder(restaurant:$restaurant,orderInput: $orderInput,paymentMethod:$paymentMethod,couponCode:$couponCode,tipping:$tipping, taxationAmount: $taxationAmount, address:$address, orderDate: $orderDate,isPickedUp: $isPickedUp, deliveryCharges:$deliveryCharges, instructions: $instructions) {
      _id
      orderId
      restaurant{
        _id
        name
        image
        address
        location{coordinates}
      }
      deliveryAddress{
        location{coordinates}
        deliveryAddress
        id
      }
      items{
        _id
        title
        food
        description
        quantity
        variation{
          _id
          title
          price
          discounted
        }
        addons{
          _id
          options{
            _id
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
      user{
        _id
        name
        phone
      }
      rider{
        _id
        name
      }
      review{
        _id
      }
      paymentMethod
      paidAmount
      orderAmount
      orderStatus
      orderDate
      expectedTime
      isPickedUp
      tipping
      taxationAmount
      createdAt
      completionTime
      preparationTime
      deliveryCharges
      acceptedAt
      pickedAt
      deliveredAt
      cancelledAt
      assignedAt
      instructions
    }
  }`;
