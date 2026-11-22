import gql from 'graphql-tag'
import { orderMoneyFields } from './queries'

export const sendChatMessage = `mutation SendChatMessage($orderId: ID!, $messageInput: ChatMessageInput!) {
    sendChatMessage(message: $messageInput, orderId: $orderId) {
      success
      message
      data {
        id
        message
        user {
          id
          name
        }
        createdAt
      }
    }
  }
  `

export const placeOrder = `
  mutation PlaceOrder($restaurant:String!,$orderInput:[OrderItemInput!]!,$paymentMethod:String!,$couponCode:String,$tipping:Float!, $taxationAmount: Float!,$address:PlaceOrderAddressInput!, $orderDate: String!,$isPickedUp: Boolean!, $deliveryCharges: Float!, $instructions: String, $loyaltyPointsToRedeem: Int, $isExpress: Boolean){
    placeOrder(restaurant:$restaurant,orderInput: $orderInput,paymentMethod:$paymentMethod,couponCode:$couponCode,tipping:$tipping, taxationAmount: $taxationAmount, address:$address, orderDate: $orderDate,isPickedUp: $isPickedUp, deliveryCharges:$deliveryCharges, instructions: $instructions, loyaltyPointsToRedeem: $loyaltyPointsToRedeem, isExpress: $isExpress) {
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
      ${orderMoneyFields}
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
      discountAmount
      loyaltyDiscount
      isExpress
    }
  }`

export const pushToken = `mutation PushToken($token:String){
    pushToken(token:$token){
      _id
      notificationToken
    }
  }`

export const unregisterPushToken = `mutation UnregisterPushToken($token: String!) {
    unregisterPushToken(token: $token)
  }`

// `changePassword` and `login` mutations were removed: the backend delegates all
// identity to Clerk, so password changes go through Clerk `user.updatePassword()`
// and sign-in/sign-up through `@clerk/clerk-expo` hooks.

export const Deactivate = `
  mutation deactivated($isActive: Boolean!, $email: String!) {
    Deactivate(isActive: $isActive,email: $email) {
      isActive
    }
  }
  `

export const applyCoupon = `mutation Coupon($coupon: String!, $restaurantId: ID!) {
  coupon(coupon: $coupon, restaurantId: $restaurantId) {
    coupon {
      _id
      discount
      enabled
      title
    }
    message
    success
  }
}`

export const deleteAddress = `mutation DeleteAddress($id:ID!){
    deleteAddress(id:$id){
      _id
      addresses{
        _id
        label
        deliveryAddress
        details
        location{coordinates}
      }
    }
  }`

export const deleteBulkAddresses = `mutation DeleteBulkAddresses($ids:[ID!]!){
  deleteBulkAddresses(ids:$ids){
      _id
      addresses{
        _id
        label
        deliveryAddress
        details
        location{coordinates}
      }
    }
  }`

export const createAddress = `mutation CreateAddress($addressInput:AddressInput!){
    createAddress(addressInput:$addressInput){
      _id
      addresses{
        _id
        label
        deliveryAddress
        details
        location{coordinates}
        selected
      }
    }
  }`

export const editAddress = `mutation EditAddress($addressInput:AddressInput!){
    editAddress(addressInput:$addressInput){
      _id
      addresses{
        _id
        label
        deliveryAddress
        details
        location{coordinates}
        selected
      }
    }
  }`

export const selectAddress = `mutation SelectAddress($id:String!){
    selectAddress(id:$id){
      _id
      addresses{
        _id
        label
        deliveryAddress
        details
        location{coordinates}
        selected
      }
    }
  }`

export const reviewOrder = `mutation ReviewOrder(
    $order:String!,
    $rating:Int!,
    $description:String,
  ){
    reviewOrder(reviewInput:{
      order:$order,
      rating:$rating,
      description:$description,
    }){
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
      ${orderMoneyFields}
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
  }`

export const addFavouriteRestaurant = `mutation AddFavourite($id:String!){
    addFavourite(id:$id){
      _id
      addresses{
        _id
        label
        deliveryAddress
        details
        location{coordinates}
        selected
      }
    }
  }`

export const updateUser = `
      mutation UpdateUser($name:String!,$phone:String,$phoneIsVerified:Boolean,$emailIsVerified:Boolean){
          updateUser(updateUserInput:{name:$name,phone:$phone,phoneIsVerified:$phoneIsVerified,emailIsVerified:$emailIsVerified}){
            _id
            name
            phone
            phoneIsVerified
            emailIsVerified
          }
        }`

export const updateNotificationStatus = `
          mutation UpdateNotificationStatus($offerNotification:Boolean!,$orderNotification:Boolean!){
            updateNotificationStatus(offerNotification:$offerNotification,orderNotification:$orderNotification){
              _id
              notificationToken
              isOrderNotification
              isOfferNotification
            }
          }`

export const cancelOrder = `
          mutation($abortOrderId: String!){
            abortOrder(id: $abortOrderId) {
              _id
              orderStatus
            }
          }`

export const createActivity = `
   mutation createActivity(
      $groupId: String!
      $module: String!
      $screenPath: String!
      $type: String!
      $details: String!
    ) {
        createActivity(
          groupId:$groupId
          module: $module
          screenPath: $screenPath
          type: $type
          details: $details
      )
    }
`

export const sendOtpToPhoneNumber = `
  mutation SendOtpToPhoneNumber($phone: String!) {
    sendOtpToPhoneNumber(phone: $phone) {
      result
    }
  }
  `

export const VERIFY_OTP = gql`
 mutation VerifyOtp($otp: String!, $email: String, $phone: String) {
    verifyOtp(otp: $otp, email: $email, phone: $phone) {
        result
    }
}
`

export const MARK_ORDER_DELIVERED = gql`
  mutation MarkOrderDelivered($id: String!) {
    markOrderDelivered(id: $id) {
      _id
      orderStatus
      customerDeliveredAt
      riderDeliveredAt
      deliveredAt
    }
  }
`

export const reOrder = `
  mutation ReOrder($orderId: String!) {
    reOrder(orderId: $orderId) {
      _id
      orderId
      orderStatus
      orderAmount
      deliveryCharges
      items {
        _id
        title
        quantity
        variation { _id title price }
        addons { _id title options { _id title price } }
      }
    }
  }
`

export const MARK_NOTIFICATIONS_READ = gql`
  mutation MarkNotificationsRead {
    markNotificationsRead
  }
`

export const INITIATE_WALLET_TOPUP = gql`
  mutation InitiateWalletTopUp($amount: Float!) {
    initiateWalletTopUp(amount: $amount)
  }
`
