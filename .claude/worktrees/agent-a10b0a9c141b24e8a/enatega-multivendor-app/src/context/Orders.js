import React, { useEffect, useContext } from 'react'
import { useApolloClient, useQuery } from '@apollo/client'
import gql from 'graphql-tag'
import { myOrders } from '../apollo/queries'
import { orderStatusChanged } from '../apollo/subscriptions'
import UserContext from './User'
import { ACTIVE_ORDER_STATUSES } from '../utils/enums'

const ORDERS = gql`
  ${myOrders}
`
const SUBSCRIPTION_ORDERS = gql`
  ${orderStatusChanged}
`

const OrdersContext = React.createContext()

const normalizeOrder = (order) => {
  if (!order || order.orderStatus) return order
  const legacyStatus = typeof order.status === 'string' ? order.status.toUpperCase() : null
  if (!legacyStatus) return order
  return {
    ...order,
    orderStatus: legacyStatus
  }
}

const mergeOrders = (...orderLists) => {
  const seen = new Set()
  return orderLists
    .flat()
    .filter(Boolean)
    .map(normalizeOrder)
    .filter((order) => {
      if (!order?._id || seen.has(order._id)) return false
      seen.add(order._id)
      return true
    })
}

const upsertOrder = (orders = [], order) => {
  const normalizedOrder = normalizeOrder(order)
  if (!normalizedOrder?._id) return orders
  const exists = orders.some((current) => current?._id === normalizedOrder._id)
  return exists
    ? orders.map((current) => (current?._id === normalizedOrder._id ? normalizedOrder : current))
    : [normalizedOrder, ...orders]
}

const syncActiveOrders = (orders = [], order) => {
  const normalizedOrder = normalizeOrder(order)
  if (!normalizedOrder?._id) return orders
  if (ACTIVE_ORDER_STATUSES.includes(normalizedOrder.orderStatus)) {
    return upsertOrder(orders, normalizedOrder)
  }
  return orders.filter((current) => current?._id !== normalizedOrder._id)
}

export const OrdersProvider = ({ children }) => {
  const client = useApolloClient()
  const { profile } = useContext(UserContext)
  const {
    called: calledOrders,
    loading: loadingOrders,
    error: errorOrders,
    data: dataOrders,
    networkStatus: networkStatusOrders,
    fetchMore: fetchMoreOrders,
    refetch: reFetchOrders,
    subscribeToMore: subscribeToMoreOrders
  } = useQuery(ORDERS, {
    fetchPolicy: 'network-only',
    onError,
    // pollInterval:2000,
    skip: !profile
  })

  function onError(error) {
    console.log('error context orders', error?.message)
  }

  useEffect(() => {
    if (!profile) return undefined
    return subscribeOrders()
  }, [profile?._id])

  const subscribeOrders = () => {
    try {
      const unsubscribeOrders = subscribeToMoreOrders({
        document: SUBSCRIPTION_ORDERS,
        variables: { userId: profile?._id },
        updateQuery: (prev, { subscriptionData }) => {
          if (!subscriptionData?.data) return prev
          const order = subscriptionData?.data?.orderStatusChanged?.order
          if (!order?._id) return prev
          const origin = subscriptionData?.data?.orderStatusChanged?.origin
          if (origin === 'new') {
            return {
              ...prev,
              orders: upsertOrder(prev?.orders, order),
              getUsersActiveOrders: syncActiveOrders(prev?.getUsersActiveOrders, order)
            }
          } else if (origin === 'update' || origin === 'status') {
            // Replace the order in place so a status update doesn't yank it to
            // the bottom of the list; append only if it isn't already present.
            return {
              ...prev,
              orders: upsertOrder(prev?.orders, order),
              getUsersActiveOrders: syncActiveOrders(prev?.getUsersActiveOrders, order)
            }
          }
          return prev
        }
      })
      const unregisterResetHandler = client.onResetStore(async() => {
        unsubscribeOrders()
      })
      return () => {
        unregisterResetHandler()
        unsubscribeOrders()
      }
    } catch (error) {
      console.log('error subscribing order', error?.message)
      return undefined
    }
  }

  const fetchMoreOrdersFunc = () => {
    if (networkStatusOrders === 7) {
      fetchMoreOrders({
        variables: { offset: dataOrders?.orders?.length }
      })
    }
  }

  const orders = mergeOrders(dataOrders?.getUsersActiveOrders, dataOrders?.orders)

  return (
    <OrdersContext.Provider
      value={{
        loadingOrders: loadingOrders && calledOrders,
        errorOrders,
        orders,
        reFetchOrders,
        fetchMoreOrdersFunc,
        networkStatusOrders
      }}>
      {children}
    </OrdersContext.Provider>
  )
}

export const OrdersConsumer = OrdersContext.Consumer
export default OrdersContext
