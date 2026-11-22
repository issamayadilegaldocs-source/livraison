import React, { useContext, useState, useEffect } from 'react'
import { View, TouchableOpacity, Image, FlatList, StyleSheet } from 'react-native'
import TextError from '../Text/TextError/TextError'
import TextDefault from '../Text/TextDefault/TextDefault'
import { scale } from '../../utils/scaling'
import { useTranslation } from 'react-i18next'
import ConfigurationContext from '../../context/Configuration'
import { calulateRemainingTime } from '../../utils/customFunctions'
import Spinner from '../Spinner/Spinner'
import EmptyOrders from '../../assets/SVG/imageComponents/EmptyOrders'
import { useBottomTabBarScroll, useShowBottomTabBarOnFocus } from '../../context/BottomTabBarVisibility'
import { formatMoneyModel } from '../../utils/formatCurrency'

const ORDER_DESIGN = {
  green: '#22C55E',
  screen: '#F6F6F6',
  white: '#FFF',
  black: '#111',
  muted: '#AFAFAF',
  border: '#F0F0F0',
  pendingBorder: '#E0E0E0',
  body: '#374151',
  meta: '#757575',
  softGreen: '#F0FDF4'
}

const ActiveOrders = ({ navigation, loading, error, activeOrders }) => {
  const { t } = useTranslation()
  const configuration = useContext(ConfigurationContext)
  const handleBottomTabBarScroll = useBottomTabBarScroll()
  useShowBottomTabBarOnFocus()

  const emptyView = () => {
    return (
      <OrdersEmptyState
        title={t('titleEmptyActiveOrders')}
        description={t('emptyActiveOrdersDesc')}
        buttonText={t('emptyActiveOrdersBtn')}
        navigation={navigation}
      />
    )
  }

  const renderItem = ({ item }) => <Item item={item} navigation={navigation} configuration={configuration} />

  if (loading) {
    return <Spinner size={'small'} backColor={ORDER_DESIGN.screen} spinnerColor={ORDER_DESIGN.green} />
  }
  if (error) return <TextError text={error.message} />

  return <FlatList data={activeOrders} renderItem={renderItem} keyExtractor={(item, index) => index.toString()} ListEmptyComponent={emptyView} onScroll={handleBottomTabBarScroll} scrollEventThrottle={16} contentContainerStyle={orderStyles.listContent} />
}

const getItems = (items) => {
  return items?.map((item) => `${item.quantity}x ${item.title}${item.variation?.title ? `(${item.variation.title})` : ''}`).join('\n')
}

const getItemCount = (items) => {
  return items?.reduce((total, item) => total + Number(item.quantity || 0), 0) || 0
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

const getStatusStep = (status) => {
  switch (status) {
    case 'PENDING':
      return 0
    case 'ACCEPTED':
      return 1
    case 'PREPARED':
    case 'AWAITING_RIDER':
    case 'ASSIGNED':
    case 'PICKED':
      return 2
    case 'DELIVERED':
    case 'COMPLETED':
      return 3
    default:
      return 0
  }
}

const getStatusMessage = (status, t) => {
  switch (status) {
    case 'PENDING':
      return t('PenddingText')
    case 'ACCEPTED':
    case 'PREPARED':
    case 'AWAITING_RIDER':
    case 'ASSIGNED':
    case 'PICKED':
      return t('PenddingText1')
    default:
      return t('PenddingText1')
  }
}

const ProgressStep = ({ label, index, currentStep }) => {
  const isDone = index < currentStep || (index === 3 && currentStep === 3)
  const isActive = index === currentStep && index !== 3
  const isReached = index <= currentStep

  return (
    <View style={orderStyles.step}>
      <View style={[orderStyles.stepDot, isReached ? orderStyles.stepDotReached : orderStyles.stepDotPending, isActive && orderStyles.stepDotActive]}>
        {isDone && (
          <TextDefault textColor={ORDER_DESIGN.white} style={orderStyles.checkText}>
            {'\u2713'}
          </TextDefault>
        )}
      </View>
      <TextDefault center textColor={isReached ? ORDER_DESIGN.body : ORDER_DESIGN.muted} style={[orderStyles.stepLabel, isActive && orderStyles.stepLabelActive]}>
        {label}
      </TextDefault>
    </View>
  )
}

const Connector = ({ active }) => <View style={[orderStyles.connector, active && orderStyles.connectorActive]} />

const OrdersEmptyState = ({ title, description, buttonText, navigation }) => {
  return (
    <View style={orderStyles.emptyContainer}>
      <View style={orderStyles.emptyIllustration}>
        <EmptyOrders width={scale(86)} height={scale(86)} />
      </View>
      <TextDefault textColor={ORDER_DESIGN.black} bolder center style={orderStyles.emptyTitle}>
        {title}
      </TextDefault>
      <TextDefault textColor={ORDER_DESIGN.meta} center style={orderStyles.emptyDescription}>
        {description}
      </TextDefault>
      <TouchableOpacity
        activeOpacity={0.85}
        style={orderStyles.emptyButton}
        onPress={() =>
          navigation.navigate({
            name: 'Home',
            merge: true
          })
        }>
        <TextDefault textColor={ORDER_DESIGN.white} bolder center style={orderStyles.emptyButtonText}>
          {buttonText}
        </TextDefault>
      </TouchableOpacity>
    </View>
  )
}

const Item = ({ item, navigation, configuration }) => {
  const [remainingTimeState, setRemainingTimeState] = useState(calulateRemainingTime(item))
  const { t } = useTranslation()
  const currentStep = getStatusStep(item.orderStatus)
  const remainingTime = Math.max(remainingTimeState || 0, 0)
  const itemCount = getItemCount(item.items)
  const itemsLabel = itemCount === 1 ? '1 item' : `${itemCount} items`
  const orderAmount = formatMoneyModel(
    item.orderAmountMoney,
    item.orderAmount,
    {
      suffix: configuration?.currency,
      decimals: configuration?.currencyDecimalDigits ?? 2
    }
  )

  // Status updates arrive via the global `orderStatusChanged` subscription
  // (OrdersContext) through the normalized cache — no per-row subscription.

  // Add useEffect to update the remaining time every second
  useEffect(() => {
    const intervalId = setInterval(() => {
      const updatedTime = calulateRemainingTime(item)
      setRemainingTimeState(updatedTime)

      // Clear interval if time reaches zero
      if (updatedTime <= 0) {
        clearInterval(intervalId)
      }
    }, 1000)

    // Clean up interval on unmount
    return () => clearInterval(intervalId)
  }, [item])

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('OrderDetail', { _id: item?._id })}>
      <View style={orderStyles.card}>
        <View style={orderStyles.restaurantHeader}>
          {item?.restaurant?.image
            ? (
            <Image style={orderStyles.restaurantImage} resizeMode='cover' source={{ uri: item?.restaurant?.image }} />
              )
            : (
            <View style={orderStyles.initialBadge}>
              <TextDefault textColor={ORDER_DESIGN.white} style={orderStyles.initialText}>
                {getRestaurantInitial(item?.restaurant?.name)}
              </TextDefault>
            </View>
              )}
          <View style={orderStyles.restaurantInfo}>
            <TextDefault textColor={ORDER_DESIGN.black} bolder numberOfLines={1} style={orderStyles.restaurantName} isRTL>
              {item?.restaurant?.name}
            </TextDefault>
            <TextDefault textColor={ORDER_DESIGN.meta} numberOfLines={1} style={orderStyles.restaurantMeta} isRTL>
              {itemsLabel}
            </TextDefault>
          </View>
          <TextDefault textColor={ORDER_DESIGN.black} bolder style={orderStyles.amount} isRTL>
            {orderAmount}
          </TextDefault>
        </View>

        <View style={orderStyles.estimateBlock}>
          <TextDefault uppercase textColor={ORDER_DESIGN.muted} style={orderStyles.eyebrow} isRTL>
            {t('estimatedDeliveryTime')}
          </TextDefault>
          <View style={orderStyles.timeRow}>
            <TextDefault textColor={ORDER_DESIGN.black} bolder style={orderStyles.timeValue} isRTL>
              {remainingTime}-{remainingTime + 5}
            </TextDefault>
            <TextDefault textColor='#9CA3AF' style={orderStyles.timeUnit} isRTL>
              {t('mins')}
            </TextDefault>
          </View>
        </View>

        <View style={orderStyles.progressBlock}>
          <ProgressStep label={t('statusOrderPalced')} index={0} currentStep={currentStep} />
          <Connector active={currentStep >= 1} />
          <ProgressStep label='Preparing' index={1} currentStep={currentStep} />
          <Connector active={currentStep >= 2} />
          <ProgressStep label='On the way' index={2} currentStep={currentStep} />
          <Connector active={currentStep >= 3} />
          <ProgressStep label='Delivered' index={3} currentStep={currentStep} />
        </View>

        <View style={orderStyles.statusMessage}>
          <View style={orderStyles.statusDot} />
          <TextDefault textColor={ORDER_DESIGN.body} style={orderStyles.statusText} isRTL>
            {getStatusMessage(item.orderStatus, t)}
          </TextDefault>
        </View>

        <View style={orderStyles.divider} />

        <View style={orderStyles.summaryBlock}>
          <TextDefault uppercase textColor={ORDER_DESIGN.muted} style={orderStyles.summaryTitle} isRTL>
            {t('yourOrder')}
          </TextDefault>
          <TextDefault textColor={ORDER_DESIGN.body} numberOfLines={3} style={orderStyles.summaryItems} isRTL>
            {getItems(item.items)}
          </TextDefault>
        </View>

        <View style={orderStyles.divider} />

        <View style={orderStyles.footer}>
          <View />
          <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('OrderDetail', { _id: item?._id })}>
            <TextDefault textColor={ORDER_DESIGN.black} bolder style={orderStyles.detailsText}>
              {t('details')}
            </TextDefault>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  )
}

const orderStyles = StyleSheet.create({
  listContent: {
    flexGrow: 1,
    paddingTop: scale(16),
    paddingHorizontal: scale(16),
    paddingBottom: scale(24)
  },
  card: {
    backgroundColor: ORDER_DESIGN.white,
    borderRadius: scale(20),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.09,
    shadowRadius: 20,
    elevation: 3
  },
  restaurantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(14),
    paddingHorizontal: scale(18),
    paddingTop: scale(18),
    paddingBottom: scale(16)
  },
  restaurantImage: {
    width: scale(52),
    height: scale(52),
    borderRadius: scale(14),
    backgroundColor: '#B84030'
  },
  initialBadge: {
    width: scale(52),
    height: scale(52),
    borderRadius: scale(14),
    backgroundColor: '#B84030',
    alignItems: 'center',
    justifyContent: 'center'
  },
  initialText: {
    fontSize: scale(18),
    fontWeight: '800'
  },
  restaurantInfo: {
    flex: 1,
    minWidth: 0
  },
  restaurantName: {
    fontSize: scale(17),
    fontWeight: '800'
  },
  restaurantMeta: {
    marginTop: scale(2),
    fontSize: scale(12),
    fontWeight: '500'
  },
  amount: {
    fontSize: scale(15),
    fontWeight: '800'
  },
  estimateBlock: {
    paddingHorizontal: scale(18),
    paddingBottom: scale(20)
  },
  eyebrow: {
    marginBottom: scale(6),
    fontSize: scale(11),
    fontWeight: '600',
    letterSpacing: 0.8
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: scale(6)
  },
  timeValue: {
    fontSize: scale(42),
    lineHeight: scale(46),
    fontWeight: '800'
  },
  timeUnit: {
    fontSize: scale(18),
    fontWeight: '600'
  },
  progressBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: scale(18),
    paddingBottom: scale(18)
  },
  step: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: scale(8)
  },
  stepDot: {
    width: scale(28),
    height: scale(28),
    borderRadius: scale(14),
    alignItems: 'center',
    justifyContent: 'center'
  },
  stepDotReached: {
    backgroundColor: ORDER_DESIGN.green
  },
  stepDotPending: {
    backgroundColor: ORDER_DESIGN.border,
    borderWidth: 2,
    borderColor: ORDER_DESIGN.pendingBorder
  },
  stepDotActive: {
    shadowColor: ORDER_DESIGN.green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 2
  },
  checkText: {
    fontSize: scale(12),
    fontWeight: '800',
    lineHeight: scale(14)
  },
  stepLabel: {
    minHeight: scale(30),
    fontSize: scale(10),
    lineHeight: scale(14),
    fontWeight: '500'
  },
  stepLabelActive: {
    fontWeight: '700'
  },
  connector: {
    width: scale(20),
    height: 2,
    marginTop: scale(13),
    backgroundColor: ORDER_DESIGN.pendingBorder
  },
  connectorActive: {
    backgroundColor: ORDER_DESIGN.green
  },
  statusMessage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: scale(10),
    marginHorizontal: scale(18),
    marginBottom: scale(18),
    paddingHorizontal: scale(14),
    paddingVertical: scale(12),
    borderRadius: scale(12),
    backgroundColor: ORDER_DESIGN.softGreen
  },
  statusDot: {
    width: scale(7),
    height: scale(7),
    borderRadius: scale(3.5),
    marginTop: scale(5),
    backgroundColor: ORDER_DESIGN.green
  },
  statusText: {
    flex: 1,
    fontSize: scale(13),
    lineHeight: scale(20),
    fontWeight: '500'
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: ORDER_DESIGN.border
  },
  summaryBlock: {
    paddingHorizontal: scale(18),
    paddingVertical: scale(14)
  },
  summaryTitle: {
    marginBottom: scale(8),
    fontSize: scale(11),
    fontWeight: '700',
    letterSpacing: 0.5
  },
  summaryItems: {
    fontSize: scale(13),
    lineHeight: scale(22),
    fontWeight: '500'
  },
  footer: {
    minHeight: scale(60),
    paddingHorizontal: scale(18),
    paddingVertical: scale(12),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  detailsText: {
    fontSize: scale(13),
    fontWeight: '700',
    textDecorationLine: 'underline'
  },
  emptyContainer: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: scale(32),
    paddingTop: scale(64),
    paddingBottom: scale(40)
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

export default ActiveOrders
