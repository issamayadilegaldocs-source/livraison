import React, { useContext } from 'react'
import { View, TouchableOpacity, Image, FlatList, StyleSheet, Alert } from 'react-native'
import { useApolloClient } from '@apollo/client'
import { v1 as uuidv1 } from 'uuid'
import TextError from '../Text/TextError/TextError'
import TextDefault from '../Text/TextDefault/TextDefault'
import Spinner from '../../components/Spinner/Spinner'
import OrdersContext from '../../context/Orders'
import UserContext from '../../context/User'
import { useTranslation } from 'react-i18next'
import ConfigurationContext from '../../context/Configuration'
import StarIcon from '../../../src/assets/SVG/imageComponents/starIcon'
import EmptyOrders from '../../assets/SVG/imageComponents/EmptyOrders'
import { scale } from '../../utils/scaling'
import { useBottomTabBarScroll, useShowBottomTabBarOnFocus } from '../../context/BottomTabBarVisibility'
import { RESTAURANT } from '../../ui/hooks/useRestaurant'
import { ACTIVE_ORDER_STATUSES, PAST_ORDER_STATUSES } from '../../utils/enums'
import { formatMoneyModel } from '../../utils/formatCurrency'

const ORDER_DESIGN = {
  green: '#22C55E',
  white: '#FFF',
  black: '#111',
  muted: '#AFAFAF',
  border: '#F0F0F0',
  softGreen: '#F0FDF4',
  meta: '#757575',
  button: '#F3F3F3'
}

function emptyViewPastOrders({ orders, loadingOrders, errorOrders, navigation, t }) {
  if (loadingOrders) {
    return <Spinner visible={loadingOrders} backColor='transparent' spinnerColor={ORDER_DESIGN.green} />
  }
  if (errorOrders) return <TextError text={errorOrders.message} />

  const hasActiveOrders = orders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.orderStatus)).length > 0
  const hasPastOrders = orders.filter((o) => PAST_ORDER_STATUSES.includes(o.orderStatus)).length > 0
  if (hasActiveOrders || hasPastOrders) return null

  return (
    <OrdersEmptyState
      title={t('titleEmptyPastOrders')}
      description={t('emptyPastOrdersDesc')}
      buttonText={t('emptyPastOrdersBtn')}
      navigation={navigation}
    />
  )
}

const PastOrders = ({ navigation, loading, error, pastOrders, onPressReview }) => {
  const { t } = useTranslation()
  const client = useApolloClient()
  const configuration = useContext(ConfigurationContext)
  const { updateCart, setCartRestaurant } = useContext(UserContext)
  const handleBottomTabBarScroll = useBottomTabBarScroll()
  useShowBottomTabBarOnFocus()
  const { orders, loadingOrders, errorOrders, reFetchOrders, fetchMoreOrdersFunc, networkStatusOrders } = useContext(OrdersContext)

  const handleReorder = async(order) => {
    const restaurantId = order?.restaurant?._id
    if (!restaurantId) {
      Alert.alert('', 'This order cannot be reordered.')
      return
    }

    const restaurantData = await client.query({ query: RESTAURANT, variables: { id: restaurantId }, fetchPolicy: 'cache-first' })
    const restaurant = restaurantData?.data?.restaurant
    const foods = restaurant?.categories?.map((category) => category?.foods || []).flat() || []
    const addons = restaurant?.addons || []
    const options = restaurant?.options || []
    const cartItems = (order?.items || []).map((orderItem) => toCartItem(orderItem, foods, addons, options)).filter(Boolean)

    if (cartItems.length === 0) {
      Alert.alert('', 'This order cannot be reordered.')
      return
    }

    await setCartRestaurant(restaurantId)
    await updateCart(cartItems)
    navigation.navigate('Restaurant', { ...order.restaurant })
  }

  const renderItem = ({ item, index }) => <Item item={item} index={index} navigation={navigation} configuration={configuration} onPressReview={onPressReview} onPressReorder={handleReorder} />

  if (loading) return <></>
  if (error) return <TextError text={error.message} />

  return (
    <FlatList
      data={pastOrders}
      renderItem={renderItem}
      keyExtractor={(item, index) => index.toString()}
      ListHeaderComponent={pastOrders.length ? <HistoryHeader count={pastOrders.length} /> : null}
      ListEmptyComponent={emptyViewPastOrders({
        orders,
        loadingOrders,
        errorOrders,
        navigation,
        t
      })}
      refreshing={networkStatusOrders === 4}
      onRefresh={() => networkStatusOrders === 7 && reFetchOrders()}
      onEndReached={fetchMoreOrdersFunc}
      onScroll={handleBottomTabBarScroll}
      scrollEventThrottle={16}
      contentContainerStyle={historyStyles.listContent}
      style={historyStyles.list}
    />
  )
}

const idsMatch = (left, right) => {
  return left && right && String(left) === String(right)
}

const sameNumber = (left, right) => {
  return Number(left || 0) === Number(right || 0)
}

const sameText = (left, right) => {
  return left && right && String(left).trim().toLowerCase() === String(right).trim().toLowerCase()
}

const isBlankText = (value) => {
  return !String(value || '').trim()
}

const toCartItem = (orderItem, foods, addons, options) => {
  const food = foods.find((menuFood) => idsMatch(menuFood?._id, orderItem?.food) || sameText(menuFood?.title, orderItem?.title))
  if (!food) return null

  const variation = food.variations?.find((menuVariation) =>
    idsMatch(menuVariation?._id, orderItem?.variation?._id) ||
    food.variations.length === 1 ||
    ((sameText(menuVariation?.title, orderItem?.variation?.title) || (isBlankText(menuVariation?.title) && isBlankText(orderItem?.variation?.title))) && sameNumber(menuVariation?.price, orderItem?.variation?.price))
  )
  if (!variation) return null

  return {
    key: uuidv1(),
    _id: food._id,
    quantity: orderItem.quantity,
    variation: {
      _id: variation._id
    },
    addons: (orderItem.addons || []).map((orderAddon) => {
      const menuAddon = addons.find((addon) => idsMatch(addon?._id, orderAddon?._id) || sameText(addon?.title, orderAddon?.title))
      if (!menuAddon) return null
      const selectedOptions = (orderAddon.options || [])
        .map((orderOption) => {
          const menuOption = options.find((option) =>
            idsMatch(option?._id, orderOption?._id) ||
            (sameText(option?.title, orderOption?.title) && sameNumber(option?.price, orderOption?.price))
          )
          return menuOption ? { _id: menuOption._id } : null
        })
        .filter(Boolean)
      return {
        _id: menuAddon._id,
        options: selectedOptions
      }
    }).filter(Boolean),
    specialInstructions: orderItem.specialInstructions || ''
  }
}

const HistoryHeader = ({ count }) => {
  const { t } = useTranslation()
  const translatedTitle = t('orderHistory')

  return (
    <View style={historyStyles.header}>
      <TextDefault textColor={ORDER_DESIGN.black} bolder style={historyStyles.headerTitle}>
        {translatedTitle === 'orderHistory' ? 'Order history' : translatedTitle}
      </TextDefault>
      <TextDefault textColor={ORDER_DESIGN.muted} style={historyStyles.headerSubtitle}>
        {count} {count === 1 ? 'order' : 'orders'}
      </TextDefault>
    </View>
  )
}

const OrdersEmptyState = ({ title, description, buttonText, navigation }) => {
  return (
    <View style={historyStyles.emptyContainer}>
      <View style={historyStyles.emptyIllustration}>
        <EmptyOrders width={scale(86)} height={scale(86)} />
      </View>
      <TextDefault textColor={ORDER_DESIGN.black} bolder center style={historyStyles.emptyTitle}>
        {title}
      </TextDefault>
      <TextDefault textColor={ORDER_DESIGN.meta} center style={historyStyles.emptyDescription}>
        {description}
      </TextDefault>
      <TouchableOpacity
        activeOpacity={0.85}
        style={historyStyles.emptyButton}
        onPress={() =>
          navigation.navigate({
            name: 'Home',
            merge: true
          })
        }>
        <TextDefault textColor={ORDER_DESIGN.white} bolder center style={historyStyles.emptyButtonText}>
          {buttonText}
        </TextDefault>
      </TouchableOpacity>
    </View>
  )
}

const formatDeliveredAt = (deliveredAt) => {
  if (!deliveredAt) return 'N/A'

  const deliveryDate = new Date(deliveredAt)
  if (isNaN(deliveryDate.getTime())) return 'N/A'

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  const day = deliveryDate.getDate()
  const month = months[deliveryDate.getMonth()]
  const hours = deliveryDate.getHours()
  const minutes = deliveryDate.getMinutes()
  const formattedDay = day < 10 ? '0' + day : day
  const formattedHours = hours < 10 ? '0' + hours : hours
  const formattedMinutes = minutes < 10 ? '0' + minutes : minutes

  return `${formattedDay} ${month} ${formattedHours}:${formattedMinutes}`
}

const getItems = (items) => {
  return items.map((item) => `${item.quantity}x ${item.title}${item.variation?.title ? `(${item.variation.title})` : ''}`).join('\n')
}

const getItemsLine = (items) => {
  return getItems(items).replace(/\n/g, ', ')
}

const getRestaurantInitial = (name) => {
  if (!name) return '?'
  return name
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

const getStatusDate = (item, t) => {
  if (item.orderStatus === 'CANCELLED' || item.orderStatus === 'CANCELLEDBYREST') {
    return `${t('cancelledOn')} ${formatDeliveredAt(item.cancelledAt || item.completionTime)}`
  }
  return `${t('deliveredOn')} ${formatDeliveredAt(item.deliveredAt)}`
}

const Item = ({ item, index, navigation, configuration, onPressReview, onPressReorder }) => {
  // Past orders are terminal; any late status change still propagates through
  // the normalized cache via the global `orderStatusChanged` subscription.
  const { t } = useTranslation()
  const orderAmount = formatMoneyModel(
    item.orderAmountMoney,
    item.orderAmount,
    {
      suffix: configuration?.currency,
      decimals: configuration?.currencyDecimalDigits ?? 2
    }
  )

  return (
    <View>
      {index > 0 && <View style={historyStyles.divider} />}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() =>
          navigation.navigate('OrderDetail', {
            _id: item._id,
            currencySymbol: configuration.currencySymbol,
            restaurant: item.restaurant,
            user: item.user
          })
        }
      >
        <View style={historyStyles.row}>
          {item?.restaurant?.image
            ? (
            <Image style={historyStyles.restaurantImage} resizeMode='cover' source={{ uri: item?.restaurant?.image }} />
              )
            : (
            <View style={historyStyles.initialBadge}>
              <TextDefault textColor={ORDER_DESIGN.white} style={historyStyles.initialText}>
                {getRestaurantInitial(item?.restaurant?.name)}
              </TextDefault>
            </View>
              )}

          <View style={historyStyles.info}>
            <TextDefault textColor={ORDER_DESIGN.black} bolder numberOfLines={1} style={historyStyles.restaurantName} isRTL>
              {item.restaurant.name}
            </TextDefault>
            <TextDefault textColor={ORDER_DESIGN.meta} numberOfLines={1} style={historyStyles.metaLine} isRTL>
              {getStatusDate(item, t)} · {orderAmount}
            </TextDefault>
            <TextDefault textColor={ORDER_DESIGN.muted} numberOfLines={1} style={historyStyles.itemsLine} isRTL>
              {getItemsLine(item.items)}
            </TextDefault>
          </View>

          <View style={historyStyles.actionColumn}>
            <TouchableOpacity activeOpacity={0.7} style={historyStyles.reorderButton} onPress={() => onPressReorder(item)}>
              <TextDefault textColor={ORDER_DESIGN.black} bolder center style={historyStyles.reorderText}>
                {t('reOrder')}
              </TextDefault>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>

      {!(item.orderStatus === 'CANCELLED' || item.orderStatus === 'CANCELLEDBYREST') && (
        <View style={historyStyles.ratingRow}>
          {!item?.review && (
            <TextDefault textColor={ORDER_DESIGN.muted} style={historyStyles.ratePrompt}>
              {t('tapToRate')}
            </TextDefault>
          )}
          <View style={historyStyles.stars}>
            {[1, 2, 3, 4, 5].map((starIndex) => (
              <StarIcon disabled={Boolean(item?.review)} key={`star-icon-${starIndex}`} isFilled={starIndex <= item?.review?.rating} onPress={() => onPressReview(item, starIndex)} />
            ))}
          </View>
        </View>
      )}
    </View>
  )
}

const historyStyles = StyleSheet.create({
  list: {
    backgroundColor: ORDER_DESIGN.white
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: scale(24),
    backgroundColor: ORDER_DESIGN.white
  },
  header: {
    paddingHorizontal: scale(16),
    paddingTop: scale(20),
    paddingBottom: scale(12),
    backgroundColor: ORDER_DESIGN.white
  },
  headerTitle: {
    fontSize: scale(22),
    lineHeight: scale(28),
    fontWeight: '800'
  },
  headerSubtitle: {
    marginTop: scale(4),
    fontSize: scale(13),
    fontWeight: '500'
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: scale(16),
    backgroundColor: ORDER_DESIGN.border
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: scale(14),
    paddingHorizontal: scale(16),
    paddingTop: scale(16)
  },
  restaurantImage: {
    width: scale(56),
    height: scale(56),
    borderRadius: scale(14),
    backgroundColor: '#B84030'
  },
  initialBadge: {
    width: scale(56),
    height: scale(56),
    borderRadius: scale(14),
    backgroundColor: '#B84030',
    alignItems: 'center',
    justifyContent: 'center'
  },
  initialText: {
    fontSize: scale(14),
    fontWeight: '800'
  },
  info: {
    flex: 1,
    minWidth: 0
  },
  restaurantName: {
    marginBottom: scale(4),
    fontSize: scale(15),
    fontWeight: '700'
  },
  metaLine: {
    marginBottom: scale(3),
    fontSize: scale(12),
    fontWeight: '500'
  },
  itemsLine: {
    fontSize: scale(12),
    fontWeight: '500'
  },
  actionColumn: {
    flexShrink: 0,
    paddingTop: scale(2)
  },
  reorderButton: {
    minWidth: scale(78),
    height: scale(32),
    paddingHorizontal: scale(14),
    borderRadius: scale(16),
    backgroundColor: ORDER_DESIGN.button,
    alignItems: 'center',
    justifyContent: 'center'
  },
  reorderText: {
    fontSize: scale(12),
    fontWeight: '700'
  },
  ratingRow: {
    minHeight: scale(42),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
    paddingLeft: scale(86),
    paddingRight: scale(16),
    paddingTop: scale(10),
    paddingBottom: scale(10)
  },
  ratePrompt: {
    marginRight: scale(5),
    fontSize: scale(11),
    fontWeight: '500'
  },
  stars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(3)
  },
  emptyContainer: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: scale(32),
    paddingTop: scale(64),
    paddingBottom: scale(40),
    backgroundColor: ORDER_DESIGN.white
  },
  emptyIllustration: {
    width: scale(128),
    height: scale(128),
    borderRadius: scale(64),
    backgroundColor: ORDER_DESIGN.softGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: scale(24)
  },
  emptyTitle: {
    fontSize: scale(20),
    lineHeight: scale(26),
    fontWeight: '800',
    marginBottom: scale(8)
  },
  emptyDescription: {
    maxWidth: scale(240),
    fontSize: scale(14),
    lineHeight: scale(22),
    fontWeight: '500',
    marginBottom: scale(32)
  },
  emptyButton: {
    minHeight: scale(52),
    paddingHorizontal: scale(32),
    borderRadius: scale(26),
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyButtonText: {
    fontSize: scale(15),
    fontWeight: '700'
  }
})

export default PastOrders
