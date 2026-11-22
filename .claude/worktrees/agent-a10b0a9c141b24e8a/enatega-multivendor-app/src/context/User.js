import React, { useState, useEffect, useContext } from 'react'
import { useApolloClient, useMutation, useQuery } from '@apollo/client'
import gql from 'graphql-tag'
import { v5 as uuidv5 } from 'uuid'
import { v1 as uuidv1 } from 'uuid'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { profile } from '../apollo/queries'
import { pushToken, unregisterPushToken } from '../apollo/mutations'
import { LocationContext } from './Location'
import AuthContext from './Auth'

import analytics from '../utils/analytics'

import { useTranslation } from 'react-i18next'
import AsyncStorage from '@react-native-async-storage/async-storage'

const v1options = {
  random: [0x10, 0x91, 0x56, 0xbe, 0xc4, 0xfb, 0xc1, 0xea, 0x71, 0xb4, 0xef, 0xe1, 0x67, 0x1c, 0x58, 0x36]
}

const PROFILE = gql`
  ${profile}
`
const PUSH_TOKEN = gql`
  ${pushToken}
`
const UNREGISTER_PUSH_TOKEN = gql`
  ${unregisterPushToken}
`

const UserContext = React.createContext({})

export const UserProvider = (props) => {
  const Analytics = analytics()

  const { t } = useTranslation()

  const { isSignedIn, signOut } = useContext(AuthContext)
  const client = useApolloClient()
  const { location, setLocation } = useContext(LocationContext)
  const [cart, setCart] = useState([])
  const [restaurant, setRestaurant] = useState(null)
  const [isPickup, setIsPickup] = useState(false)
  const [instructions, setInstructions] = useState('')
  const [coupon, setCoupon] = useState(null)
  const [uploadPushToken] = useMutation(PUSH_TOKEN)
  const [unregisterToken] = useMutation(UNREGISTER_PUSH_TOKEN)

  const {
    called: calledProfile,
    loading: loadingProfile,
    error: errorProfile,
    data: dataProfile,
    refetch: refetchProfile,
    networkStatus
  } = useQuery(PROFILE, {
    // Show the cached profile (incl. saved addresses) instantly, then refresh
    // from the API in the background. `nextFetchPolicy: 'cache-first'` stops it
    // from re-hitting the network on every re-render after that first refresh —
    // mutations / refetchProfile still update it.
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
    onError,
    onCompleted,
    skip: !isSignedIn
  })

  useEffect(() => {
    let isSubscribed = true
    ;(async () => {
      const restaurant = await AsyncStorage.getItem('restaurant')
      const cart = await AsyncStorage.getItem('cartItems')
      const savedCoupon = await AsyncStorage.getItem('coupon')
      isSubscribed && setRestaurant(restaurant || null)
      isSubscribed && setCart(cart ? JSON.parse(cart) : [])
      isSubscribed && setCoupon(savedCoupon ? JSON.parse(savedCoupon) : null)
    })()
    return () => {
      isSubscribed = false
    }
  }, [])

  function onError(error) {
    console.log('error context user', error.message)
  }

  async function onCompleted(data) {
    const { _id: userId, name, email, phone } = data?.profile
    await Analytics.identify(
      {
        userId,
        name,
        email,
        phone
      },
      userId
    )
    await Analytics.track(Analytics.events.USER_RECONNECTED, {
      userId: data?.profile?._id
    })
    // Previously a push token was only ever registered while the
    // Account/Settings screen happened to be mounted (both gate the
    // upload on `!profile.notificationToken` there too) — a customer who
    // never opened either screen received zero push notifications for
    // their entire account lifetime. Register as soon as the profile is
    // confirmed loaded (i.e. the user is actually authenticated), not
    // gated behind visiting a specific screen.
    registerPushTokenIfNeeded(data?.profile).catch((error) => {
      console.log('push token registration failed', error?.message)
    })
  }

  async function registerPushTokenIfNeeded(profileData) {
    if (profileData?.notificationToken) return
    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }
    if (finalStatus !== 'granted') return
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig.extra.eas.projectId
    })
    await uploadPushToken({ variables: { token: token.data } })
  }

  const logout = async () => {
    try {
      // Must run BEFORE signOut() — the mutation needs the still-valid
      // Clerk session to authenticate. Previously nothing unregistered
      // the device's token on logout, so if a different person logged in
      // on the same device afterwards, the backend's per-token
      // reassignment guard would still eventually clear this account's
      // stale association on the NEXT registration — but until then (or
      // if the device is never reused), the token disable is one less
      // relied-upon layer. Best-effort: a failure here must never block
      // logout itself.
      if (dataProfile?.profile?.notificationToken) {
        await unregisterToken({ variables: { token: dataProfile.profile.notificationToken } }).catch(
          (error) => console.log('push token unregister failed', error?.message)
        )
      }
      await signOut()
      if (location._id) {
        setLocation({
          label: t('selectedLocation'),
          latitude: location.latitude,
          longitude: location.longitude,
          deliveryAddress: location.deliveryAddress
        })
      }
      client.cache.evict({
        id: `${dataProfile?.profile?.__typename}:${dataProfile?.profile?._id}`
      })
      await client.resetStore()
    } catch (error) {
      console.log('error on logout', error)
    }
  }

  const clearCart = async () => {
    setCart([])
    setRestaurant(null)
    setInstructions('')
    await saveCoupon(null)
    await AsyncStorage.removeItem('cartItems')
    await AsyncStorage.removeItem('restaurant')
  }

  const addQuantity = async (key, quantity = 1) => {
    const cartIndex = cart.findIndex((c) => c.key === key)
    cart[cartIndex].quantity += quantity
    setCart([...cart])
    await AsyncStorage.setItem('cartItems', JSON.stringify([...cart]))
  }

  const deleteItem = async (key) => {
    const cartIndex = cart.findIndex((c) => c.key === key)
    if (cartIndex > -1) {
      cart.splice(cartIndex, 1)
      const items = [...cart.filter((c) => c.quantity > 0)]
      setCart(items)
      if (items.length === 0) setRestaurant(null)
      await AsyncStorage.setItem('cartItems', JSON.stringify(items))
    }
  }

  const removeQuantity = async (key) => {
    const cartIndex = cart.findIndex((c) => c.key === key)
    cart[cartIndex].quantity -= 1
    const items = [...cart.filter((c) => c.quantity > 0)]
    setCart(items)
    if (items.length === 0) setRestaurant(null)
    await AsyncStorage.setItem('cartItems', JSON.stringify(items))
  }

  const checkItemCart = (itemId) => {
    const cartIndex = cart.findIndex((c) => c._id === itemId)
    if (cartIndex < 0) {
      return {
        exist: false,
        quantity: 0
      }
    } else {
      return {
        exist: true,
        quantity: cart[cartIndex].quantity,
        key: cart[cartIndex].key
      }
    }
  }

  const numberOfCartItems = () => {
    return cart
      .map((c) => c.quantity)
      .reduce(function (a, b) {
        return a + b
      }, 0)
  }

  const addCartItem = async (_id, variation, quantity = 1, addons = [], clearFlag, specialInstructions = '') => {
    const cartItems = clearFlag ? [] : cart
    cartItems.push({
      key: uuidv1(v1options),
      _id,
      quantity: quantity,
      variation: {
        _id: variation
      },
      addons,
      specialInstructions
    })

    await AsyncStorage.setItem('cartItems', JSON.stringify([...cartItems]))
    setCart([...cartItems])
  }

  const updateCart = async (cart) => {
    setCart(cart)
    await AsyncStorage.setItem('cartItems', JSON.stringify(cart))
  }

  const setCartRestaurant = async (id) => {
    setRestaurant(id)
    await AsyncStorage.setItem('restaurant', id)
  }

  const saveCoupon = async (couponData) => {
    setCoupon(couponData)
    if (couponData) {
      await AsyncStorage.setItem('coupon', JSON.stringify(couponData))
    } else {
      await AsyncStorage.removeItem('coupon')
    }
  }

  return (
    <UserContext.Provider
      value={{
        isLoggedIn: !!isSignedIn && dataProfile && !!dataProfile?.profile,
        loadingProfile: loadingProfile && calledProfile,
        errorProfile,
        profile: dataProfile && dataProfile?.profile ? dataProfile?.profile : null,
        logout,
        cart,
        cartCount: numberOfCartItems(),
        clearCart,
        updateCart,
        addQuantity,
        removeQuantity,
        addCartItem,
        checkItemCart,
        deleteItem,
        restaurant,
        setCartRestaurant,
        refetchProfile,
        networkStatus,
        isPickup,
        setIsPickup,
        instructions,
        setInstructions,
        coupon,
        setCoupon: saveCoupon
      }}
    >
      {props.children}
    </UserContext.Provider>
  )
}

export const useUserContext = () => useContext(UserContext)
export const UserConsumer = UserContext.Consumer
export default UserContext
