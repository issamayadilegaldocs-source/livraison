import { orderFields } from './queries'

export const subscriptionOrder = `subscription SubscriptionOrder($id:String!){
    subscriptionOrder(id:$id){
        _id
        orderStatus
        rider{
            _id
        }
        completionTime
        preparationTime
    }
  }`

export const orderStatusChanged = `subscription OrderStatusChanged($userId:String!){
    orderStatusChanged(userId:$userId){
      userId
      origin
      order{
        ...OrderFields
      }
    }
  }
  ${orderFields}`

export const subscriptionNewMessage = `subscription SubscriptionNewMessage($order:ID!){
  subscriptionNewMessage(order:$order){
    id
    message
    user {
      id
      name
    }
    createdAt
  }
}`
