import React, { useState, useEffect, useContext, useLayoutEffect } from 'react'
import { View, ScrollView, TouchableOpacity, StatusBar, Platform, Alert } from 'react-native'
import { useQuery } from '@apollo/client'
import gql from 'graphql-tag'
import { AntDesign, Feather } from '@expo/vector-icons'
import { Placeholder, PlaceholderLine, Fade } from 'rn-placeholder'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import CartItem from '../../components/CartItem/CartItem'
import { getTipping } from '../../apollo/queries'
import { scale } from '../../utils/scaling'
import { theme } from '../../utils/themeColors'
import ThemeContext from '../../ui/ThemeContext/ThemeContext'
import ConfigurationContext from '../../context/Configuration'
import UserContext from '../../context/User'
import styles from './styles'
import TextDefault from '../../components/Text/TextDefault/TextDefault'
import { useRestaurant } from '../../ui/hooks'
import { LocationContext } from '../../context/Location'
import EmptyCart from '../../assets/SVG/imageComponents/EmptyCart'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { formatPrice, currencyOptions } from '../../utils/formatCurrency'
import { textStyles } from '../../utils/textStyles'
import { calculateAmount, calculateDistance } from '../../utils/customFunctions'
import analytics from '../../utils/analytics'
import { HeaderBackButton } from '@react-navigation/elements'
import navigationService from '../../routes/navigationService'
import { useTranslation } from 'react-i18next'
import WouldYouLikeToAddThese from './Section'
import { SpecialInstructions } from '../../components/Cart/SpecialInstructions'
import { FlashMessage } from '../../ui/FlashMessage/FlashMessage'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'

import useNetworkStatus from '../../utils/useNetworkStatus'
import ErrorView from '../../components/ErrorView/ErrorView'

// Constants
const TIPPING = gql`
  ${getTipping}
`

function Cart(props) {
  const Analytics = analytics()
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const configuration = useContext(ConfigurationContext)
  const { isLoggedIn, profile, restaurant: cartRestaurant, cart, addQuantity, removeQuantity, clearCart, isPickup, instructions, setInstructions, coupon } = useContext(UserContext)
  const themeContext = useContext(ThemeContext)
  const { location } = useContext(LocationContext)
  const { t, i18n } = useTranslation()
  const currentTheme = {
    isRTL: i18n.dir() === 'rtl',
    ...theme[themeContext.ThemeValue]
  }
  const [loadingData, setLoadingData] = useState(true)
  const [minimumOrder, setMinimumOrder] = useState('')
  const [selectedRestaurant, setSelectedRestaurant] = useState({})
  const [deliveryCharges, setDeliveryCharges] = useState(0)

  const isCartEmpty = cart?.length === 0
  const cartLength = !isCartEmpty ? cart?.length : 0
  const { loading, data, error: restaurantError, refetch: refetchRestaurant } = useRestaurant(cartRestaurant)

  const { loading: loadingTip, data: dataTip } = useQuery(TIPPING, {
    fetchPolicy: 'cache-first'
  })
  const animatedQuantity = useSharedValue(1)

  const animateQuantityChange = () => {
    animatedQuantity.value = withSpring(1.3, {
      damping: 2, // Adjust for desired bounciness
      stiffness: 20 // Adjust for desired spring effect
    })

    setTimeout(() => {
      animatedQuantity.value = withSpring(1) // Reset scale to 1
    }, 200) // Match this duration with the spring duration
  }

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: animatedQuantity.value }]
    }
  })

  useEffect(() => {
    animateQuantityChange()
  }, [addQuantity, removeQuantity])

  const tip = props?.route.params && props?.route.params.tipAmount ? props?.route.params.tipAmount : null

  const [selectedTip, setSelectedTip] = useState()
  useEffect(() => {
    const tipVariations = dataTip?.tips?.tipVariations
    if (tip) {
      setSelectedTip(null)
    } else if (tipVariations?.length && !selectedTip) {
      setSelectedTip(tipVariations[1] ?? tipVariations[0])
    }
  }, [tip, data])

  useEffect(() => {
    let isSubscribed = true
    ;(async () => {
      if (data && data?.restaurant) {
        const latOrigin = Number(data?.restaurant.location.coordinates[1])
        const lonOrigin = Number(data?.restaurant.location.coordinates[0])
        const latDest = Number(location.latitude)
        const longDest = Number(location.longitude)
        const distance = await calculateDistance(latOrigin, lonOrigin, latDest, longDest)
        let costType = configuration.costType
        const shaping = {
          min: configuration.deliveryFeeMinimum,
          max: configuration.deliveryFeeMaximum,
          round: configuration.deliveryRoundToNearest
        }
        let amount = calculateAmount(
          costType,
          configuration.deliveryRate,
          distance,
          configuration.baseDeliveryFee,
          configuration.baseDeliveryDistance,
          shaping
        )

        if (isSubscribed) {
          setDeliveryCharges(
            amount > 0
              ? amount
              : calculateAmount('fixed', configuration.deliveryRate, 0, 0, 0, shaping)
          )
        }
      }
    })()
    return () => {
      isSubscribed = false
    }
  }, [data, location])

  useFocusEffect(() => {
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor(currentTheme.menuBar)
    }
    StatusBar.setBarStyle(themeContext.ThemeValue === 'Dark' ? 'light-content' : 'dark-content')
  })

  useLayoutEffect(() => {
    props?.navigation.setOptions({
      headerTitle: () => (
        <View style={styles().headerTitleBlock}>
          <TextDefault textColor={currentTheme.newFontcolor} style={styles().headerTitleText} bolder center>
            {t('titleCart')}
          </TextDefault>
          {!!selectedRestaurant?.name && (
            <TextDefault textColor={currentTheme.fontNewColor} style={styles().headerSubtitleText} center numberOfLines={1}>
              {selectedRestaurant.name}
            </TextDefault>
          )}
        </View>
      ),
      headerRight: () => (
        <TouchableOpacity activeOpacity={0.7} style={styles(currentTheme).headerIconButton}>
          <Feather name='info' size={scale(17)} color={currentTheme.newIconColor} />
        </TouchableOpacity>
      ),
      headerTitleAlign: 'center',
      headerTitleStyle: {
        color: currentTheme.newFontcolor,
        ...textStyles.H4,
        ...textStyles.Bolder
      },
      headerTitleContainerStyle: {
        paddingLeft: scale(25),
        paddingRight: scale(25)
      },
      headerStyle: {
        backgroundColor: currentTheme.newheaderBG
      },
      headerLeft: () => (
        <HeaderBackButton
          truncatedLabel=''
          backImage={() => (
            <View style={styles(currentTheme).headerIconButton}>
              <AntDesign name={currentTheme.isRTL ? 'arrowright' : 'arrowleft'} size={20} color={currentTheme.newIconColor} />
            </View>
          )}
          onPress={() => {
            navigationService.goBack()
          }}
        />
      )
    })
  }, [props?.navigation, selectedRestaurant?.name, currentTheme.isRTL])

  useLayoutEffect(() => {
    if (!data) return
    didFocus()
  }, [data])
  useEffect(() => {
    async function Track() {
      await Analytics.track(Analytics.events.NAVIGATE_TO_CART)
    }
    Track()
  }, [])
  // useEffect(() => {
  //   if (cart && cartCount > 0) {
  //     if (
  //       data &&
  //       data?.restaurant &&
  //       (!data?.restaurant?.isAvailable || !isOpen(data?.restaurant))
  //     ) {
  //       showAvailablityMessage()
  //     }
  //   }
  // }, [data])

  const showAvailablityMessage = () => {
    Alert.alert(
      '',
      `${data?.restaurant.name} ${t('restaurantClosed')}`,
      [
        {
          text: t('backToRestaurants'),
          onPress: () => {
            props?.navigation.navigate({
              name: 'Main',
              merge: true
            })
          },
          style: 'cancel'
        },
        {
          text: isLoggedIn && profile ? t('continueBtn') : t('close'),
          onPress: () => {},
          style: 'cancel'
        }
      ],
      { cancelable: true }
    )
  }

  const decimals = configuration?.currencyDecimalDigits ?? 2

  function calculatePrice(delivery = 0, withDiscount) {
    let itemTotal = 0
    cart.forEach((cartItem) => {
      const food = populateFood(cartItem)
      if (!food) return
      itemTotal += food.price * food.quantity
    })
    if (withDiscount && coupon && coupon.discount) {
      itemTotal = itemTotal - (coupon.discount / 100) * itemTotal
    }
    // const deliveryAmount = delivery > 0 ? deliveryCharges : 0
    return itemTotal.toFixed(decimals)
  }

  function calculateTotal() {
    let total = 0
    const delivery = isPickup ? 0 : deliveryCharges
    total += +calculatePrice(delivery)
    total += delivery
    // total += +taxCalculation()
    // total += +calculateTip()
    return parseFloat(total).toFixed(decimals)
  }

  function formatAmount(amount) {
    return formatPrice(parseFloat(amount || 0), currencyOptions(configuration))
  }

  async function didFocus() {
    const restaurant = data?.restaurant

    if (!restaurant) {
      if (props?.navigation.isFocused()) {
        await clearCart()
        setLoadingData(false)
      }
      return
    }

    setSelectedRestaurant(restaurant)
    setMinimumOrder(restaurant?.minimumOrder ?? 0)
    setLoadingData(false)
  }

  const { isConnected: connect, setIsConnected: setConnect } = useNetworkStatus()
  if (!connect) return <ErrorView refetchFunctions={[]} />

  // If the cart's restaurant can't be fetched at all, surface a retryable error
  // instead of gating the screen on `loadingData` forever (blank skeleton).
  // Stale/deleted restaurant ids resolve to `restaurant: null` (handled by
  // didFocus, which clears the stale cart) — this only catches real failures.
  if (restaurantError && !data) return <ErrorView refetchFunctions={[refetchRestaurant]} />

  function emptyCart() {
    return (
      <View style={styles().subContainerImage}>
        <View style={styles().imageContainer}>
          <EmptyCart width={scale(200)} height={scale(200)} />
        </View>
        <View style={styles().descriptionEmpty}>
          <TextDefault textColor={currentTheme.fontMainColor} bolder center>
            {t('hungry')}?
          </TextDefault>
          <TextDefault textColor={currentTheme.fontSecondColor} bold center>
            {t('emptyCart')}
          </TextDefault>
        </View>
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles(currentTheme).emptyButton}
          onPress={() =>
            props?.navigation.navigate({
              name: 'Main',
              merge: true
            })
          }
        >
          <TextDefault textColor={currentTheme.buttonText} bolder B700 center uppercase>
            {t('emptyCartBtn')}
          </TextDefault>
        </TouchableOpacity>
      </View>
    )
  }
  function loadginScreen() {
    return (
      <View style={styles(currentTheme).screenBackground}>
        <Placeholder Animation={(props) => <Fade {...props} style={styles(currentTheme).placeHolderFadeColor} duration={600} />} style={styles(currentTheme).placeHolderContainer}>
          <PlaceholderLine />
          <PlaceholderLine />
          <PlaceholderLine />
        </Placeholder>

        <Placeholder Animation={(props) => <Fade {...props} style={styles(currentTheme).placeHolderFadeColor} duration={600} />} style={styles(currentTheme).placeHolderContainer}>
          <PlaceholderLine style={styles().height60} />
          <PlaceholderLine />
        </Placeholder>

        <Placeholder Animation={(props) => <Fade {...props} style={styles(currentTheme).placeHolderFadeColor} duration={600} />} style={styles(currentTheme).placeHolderContainer}>
          <PlaceholderLine style={styles().height100} />
          <PlaceholderLine />
          <PlaceholderLine />
          <View style={[styles(currentTheme).horizontalLine, styles().width100, styles().mB10]} />
          <PlaceholderLine />
          <PlaceholderLine />
        </Placeholder>
        <Placeholder Animation={(props) => <Fade {...props} style={styles(currentTheme).placeHolderFadeColor} duration={600} />} style={styles(currentTheme).placeHolderContainer}>
          <PlaceholderLine style={styles().height100} />
          <PlaceholderLine />
          <PlaceholderLine />
          <View style={[styles(currentTheme).horizontalLine, styles().width100, styles().mB10]} />
          <PlaceholderLine />
          <PlaceholderLine />
        </Placeholder>
      </View>
    )
  }
  if (loading || loadingData || loadingTip) return loadginScreen()

  const restaurant = data?.restaurant
  const addons = restaurant?.addons
  const options = restaurant?.options

  const foods = restaurant?.categories?.map((c) => c.foods.flat()).flat()

  function populateFood(cartItem) {
    const food = foods?.find((food) => food._id === cartItem._id)
    if (!food) return null
    const variation = food.variations.find((variation) => variation._id === cartItem.variation._id)
    if (!variation) return null

    const title = `${food.title}${variation.title ? `(${variation.title})` : ''}`
    let price = variation.price
    const optionsTitle = []
    if (cartItem.addons) {
      cartItem.addons.forEach((addon) => {
        const cartAddon = addons.find((add) => add._id === addon._id)
        if (!cartAddon) return null
        addon.options.forEach((option) => {
          const cartOption = options.find((opt) => opt._id === option._id)
          if (!cartOption) return null
          price += cartOption.price
          optionsTitle.push(cartOption.title)
        })
      })
    }
    const populateAddons = addons.filter((addon) => food?.variations[0]?.addons?.includes(addon._id))
    return {
      ...cartItem,
      optionsTitle,
      title: title,
      price: price.toFixed(decimals),
      image: food.image,
      addons: populateAddons
    }
  }

  return (
    <>
      <View style={styles(currentTheme).mainContainer}>
        {cart?.length === 0 ? (
          emptyCart()
        ) : (
          <>
            <ScrollView showsVerticalScrollIndicator={false} style={styles().flex} contentContainerStyle={styles(insets).cartScrollContent}>
              <View style={styles(currentTheme).section}>
                <View style={styles(currentTheme).sectionHeader}>
                  <TextDefault textColor={currentTheme.fontNewColor} style={styles().sectionEyebrow} bolder uppercase isRTL>
                    {t('yourOrder')} ({cartLength})
                  </TextDefault>
                </View>
                {cart?.map((cartItem, index) => {
                  const food = populateFood(cartItem)
                  if (!food) return null
                  return (
                    <View key={cartItem._id + index} style={styles(currentTheme).itemContainer}>
                      <CartItem
                        quantity={food.quantity}
                        dealName={food.title}
                        optionsTitle={food.optionsTitle}
                        itemImage={food.image}
                        itemAddons={food.addons}
                        dealPrice={(parseFloat(food.price) * food.quantity).toFixed(decimals)}
                        restaurantData={restaurant}
                        addQuantity={() => {
                          addQuantity(food.key)
                        }}
                        removeQuantity={() => {
                          removeQuantity(food.key)
                        }}
                      />
                    </View>
                  )
                })}
                <View style={styles().addItemsContainer}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={styles(currentTheme).addItemsButton}
                    onPress={() => {
                      props?.navigation.navigate({
                        name: 'Main',
                        merge: true
                      })
                    }}
                  >
                    <Feather name='plus' size={scale(14)} color={currentTheme.newFontcolor} />
                    <TextDefault textColor={currentTheme.newFontcolor} bolder Small>
                      {t('addMore')}
                    </TextDefault>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles(currentTheme).section}>
                <SpecialInstructions instructions={instructions} onSubmitInstructions={setInstructions} theme={currentTheme} t={t} />
              </View>

              {!!foods?.[0]?._id && (
                <View style={styles(currentTheme).section}>
                  <WouldYouLikeToAddThese itemId={foods[0]._id} restaurantId={restaurant?._id} />
                </View>
              )}

              <View style={styles(currentTheme).section}>
                <TextDefault textColor={currentTheme.fontFourthColor} style={styles().summaryTitle} bolder H5 isRTL>
                  {t('totalOrderAmount')}
                </TextDefault>
                <View style={styles(currentTheme).summaryRow}>
                  <TextDefault textColor={currentTheme.fontNewColor} Normal isRTL>
                    {t('subTotal')}
                  </TextDefault>
                  <TextDefault textColor={currentTheme.fontFourthColor} bolder Normal isRTL>
                    {formatAmount(calculatePrice(0))}
                  </TextDefault>
                </View>
                <View style={styles(currentTheme).summaryRow}>
                  <TextDefault textColor={currentTheme.fontNewColor} Normal isRTL>
                    {t('deliveryFee')}
                  </TextDefault>
                  <TextDefault textColor={currentTheme.fontFourthColor} bolder Normal isRTL>
                    {formatAmount(isPickup ? 0 : deliveryCharges)}
                  </TextDefault>
                </View>
                <View style={styles(currentTheme).summaryDivider} />
                <View style={styles(currentTheme).summaryRow}>
                  <TextDefault textColor={currentTheme.fontFourthColor} bolder H5 isRTL>
                    {t('total')}
                  </TextDefault>
                  <View style={styles().summaryTotalBlock}>
                    <TextDefault textColor={currentTheme.fontFourthColor} bolder H5 right isRTL>
                      {formatAmount(calculateTotal())}
                    </TextDefault>
                    <TextDefault textColor={currentTheme.fontNewColor} style={styles().vatText} right isRTL>
                      {t('exclusiveVAt')}
                    </TextDefault>
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={styles({ ...currentTheme, bottomInset: insets.bottom }).totalBillContainer}>
              <View style={styles(currentTheme).buttonContainer}>
                {isLoggedIn && profile ? (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      if (+calculatePrice(0) < minimumOrder) {
                        FlashMessage({
                          message: t('OrderPriceValidation')
                        })
                        return
                      }
                      navigation.navigate('Checkout')
                    }}
                    style={styles(currentTheme).button}
                  >
                    <TextDefault textColor={currentTheme.white} style={styles().checkoutBtn} bold H5 isRTL>
                      {t('checkoutBtn')}
                    </TextDefault>
                    <View style={styles().checkoutDivider} />
                    <Animated.View style={[animatedStyle]}>
                      <TextDefault textColor={currentTheme.white} style={styles().checkoutBtn} bolder H5 isRTL>
                        {formatAmount(calculateTotal())}
                      </TextDefault>
                    </Animated.View>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      props?.navigation.navigate({ name: 'CreateAccount' })
                    }}
                    style={styles(currentTheme).button}
                  >
                    <TextDefault textColor={currentTheme.white} style={{ width: '100%', textAlign: 'center' }} H5 bolder center isRTL>
                      {t('loginOrSignUp')}
                    </TextDefault>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </>
        )}
      </View>
    </>
  )
}

export default Cart
