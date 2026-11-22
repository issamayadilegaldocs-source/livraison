import { View, ScrollView, Dimensions, TouchableOpacity } from 'react-native'
import TextDefault from '../../components/Text/TextDefault/TextDefault'
import { scale } from '../../utils/scaling'
import { alignment } from '../../utils/alignment'
import styles from './styles'
import React, { useCallback, useContext, useEffect, useState, useRef } from 'react'
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps'
import { Ionicons } from '@expo/vector-icons'
import ConfigurationContext from '../../context/Configuration'
import ThemeContext from '../../ui/ThemeContext/ThemeContext'
import { theme } from '../../utils/themeColors'
// import analytics from '../../utils/analytics'
import Detail from '../../components/OrderDetail/Detail/Detail'
import RestaurantMarker from '../../assets/SVG/restaurant-marker'
import CustomerMarker from '../../assets/SVG/customer-marker'
import TrackingRider from '../../components/OrderDetail/TrackingRider/TrackingRider'
import TrackingBottomSheet from '../../components/OrderDetail/TrackingBottomSheet/TrackingBottomSheet'
import PulsingMarker from '../../components/OrderDetail/PulsingMarker/PulsingMarker'
import OrderTimeline from '../../components/OrderDetail/OrderTimeline/OrderTimeline'
import StatusHero from '../../components/OrderDetail/StatusHero/StatusHero'
import OrdersContext from '../../context/Orders'
import { mapStyle } from '../../utils/mapStyle'
import { useTranslation } from 'react-i18next'
import { HelpButton } from '../../components/Header/HeaderIcons/HeaderIcons'

import { useNavigation } from '@react-navigation/native'
import { PriceRow } from '../../components/OrderDetail/PriceRow'
import { ORDER_STATUS_ENUM } from '../../utils/enums'
import { CancelModal } from '../../components/OrderDetail/CancelModal'
import Button from '../../components/Button/Button'
import { gql, useMutation } from '@apollo/client'
import { cancelOrder as cancelOrderMutation, MARK_ORDER_DELIVERED } from '../../apollo/mutations'
import { FlashMessage } from '../../ui/FlashMessage/FlashMessage'
import { calulateRemainingTime } from '../../utils/customFunctions'
import { Instructions } from '../../components/Checkout/Instructions'
import { formatMoneyModel } from '../../utils/formatCurrency'
import { safeFitToCoordinates } from '../../utils/safeFitToCoordinates'
import { haversineDistanceMeters } from '../../utils/geo'
import { CUSTOMER_TRACKING_CONFIG } from '../../utils/tracking.config'

import MapViewDirections from 'react-native-maps-directions'
import useEnvVars from '../../../environment'
import LottieView from 'lottie-react-native'
import Taxes from './Taxes'
import useNetworkStatus from '../../utils/useNetworkStatus'
import ErrorView from '../../components/ErrorView/ErrorView'

const { height: HEIGHT, width: WIDTH } = Dimensions.get('screen')

const CANCEL_ORDER = gql`
  ${cancelOrderMutation}
`

function OrderDetail(props) {
  // console.log("propsdata",props?.route.params)
  const [cancelModalVisible, setCancelModalVisible] = useState(false)
  const [riderStatusLabel, setRiderStatusLabel] = useState(null)
  const [riderLiveLocation, setRiderLiveLocation] = useState(null)
  const [autoFollow, setAutoFollow] = useState(true)
  const [directionsOrigin, setDirectionsOrigin] = useState(null)
  const lastFitAtRef = useRef(0)
  const lastFitCoordRef = useRef(null)
  const initialFitDoneRef = useRef(false)
  const lastRouteOriginRef = useRef(null)
  const lastRouteUpdateAtRef = useRef(0)
  // const Analytics = analytics()
  const { t, i18n } = useTranslation()
  const id = props?.route.params ? props?.route.params?._id : null
  const orderData = props?.route.params ? props?.route.params?.order : null
  // console.log('orderData',orderData)
  const { loadingOrders, errorOrders, orders } = useContext(OrdersContext)
  const configuration = useContext(ConfigurationContext)
  const themeContext = useContext(ThemeContext)
  const currentTheme = {
    isRTL: i18n.dir() === 'rtl',
    ...theme[themeContext.ThemeValue]
  }
  const navigation = useNavigation()
  const { GOOGLE_MAPS_KEY } = useEnvVars()
  const mapView = useRef(null)
  const { isConnected: connect } = useNetworkStatus()
  const [cancelOrder, { loading: loadingCancel }] = useMutation(CANCEL_ORDER, {
    onError,
    onCompleted: (data) => {
      setCancelModalVisible(false)
      navigation.navigate('Main')
    },
    variables: { abortOrderId: id }
  })
  const [markOrderDelivered, { loading: loadingConfirm }] = useMutation(MARK_ORDER_DELIVERED, {
    onError: (error) => FlashMessage({ message: error.message }),
    variables: { id }
  })
  // useEffect(() => {
  //   /* async function Track() {
  //     await Analytics.track(Analytics.events.NAVIGATE_TO_ORDER_DETAIL, {
  //       orderId: id
  //     })
  //   }
  //   Track() */
  // }, [])

  const cancelModalToggle = () => {
    setCancelModalVisible(!cancelModalVisible)
  }
  function onError(error) {
    setCancelModalVisible(false)
    FlashMessage({
      message: error.message
    })
  }
  let order = orders?.find((o) => {
    return o?._id === id
  })

  if (!order) {
    order = orderData
  }

  const destinationCoordinate = order?.deliveryAddress?.location?.coordinates
    ? {
        latitude: +order.deliveryAddress.location.coordinates[1],
        longitude: +order.deliveryAddress.location.coordinates[0]
      }
    : null

  // Every new authoritative rider fix (not intermediate animation frames)
  // drives two independent, separately-throttled behaviours: re-fitting the
  // camera to keep rider + destination in frame, and re-requesting the
  // directions polyline from the rider's current position so it visibly
  // shortens as the trip progresses.
  const handleRiderLocationChange = useCallback(
    (location) => {
      setRiderLiveLocation(location)
      if (!destinationCoordinate) return

      const riderCoord = { latitude: location.latitude, longitude: location.longitude }
      const now = Date.now()

      const timeSinceRouteUpdate = now - lastRouteUpdateAtRef.current
      const distanceFromRouteOrigin = lastRouteOriginRef.current
        ? haversineDistanceMeters(lastRouteOriginRef.current, riderCoord)
        : Infinity
      if (
        timeSinceRouteUpdate >= CUSTOMER_TRACKING_CONFIG.routeRefreshMinIntervalMs ||
        distanceFromRouteOrigin >= CUSTOMER_TRACKING_CONFIG.routeRefreshMinDistanceMeters
      ) {
        lastRouteUpdateAtRef.current = now
        lastRouteOriginRef.current = riderCoord
        setDirectionsOrigin(riderCoord)
      }

      if (!autoFollow) return
      const timeSinceFit = now - lastFitAtRef.current
      const distanceFromLastFit = lastFitCoordRef.current
        ? haversineDistanceMeters(lastFitCoordRef.current, riderCoord)
        : Infinity
      if (
        timeSinceFit >= CUSTOMER_TRACKING_CONFIG.autoFollowMinIntervalMs ||
        distanceFromLastFit >= CUSTOMER_TRACKING_CONFIG.autoFollowMinDistanceMeters
      ) {
        lastFitAtRef.current = now
        lastFitCoordRef.current = riderCoord
        safeFitToCoordinates(mapView, [riderCoord, destinationCoordinate], {
          edgePadding: {
            top: HEIGHT / 10,
            right: WIDTH / 8,
            bottom: HEIGHT / 6,
            left: WIDTH / 8
          },
          animated: true
        })
      }
    },
    [destinationCoordinate, autoFollow]
  )

  const handleRecenter = useCallback(() => {
    setAutoFollow(true)
    if (!riderLiveLocation || !destinationCoordinate) return
    const riderCoord = { latitude: riderLiveLocation.latitude, longitude: riderLiveLocation.longitude }
    lastFitAtRef.current = Date.now()
    lastFitCoordRef.current = riderCoord
    safeFitToCoordinates(mapView, [riderCoord, destinationCoordinate], {
      edgePadding: {
        top: HEIGHT / 10,
        right: WIDTH / 8,
        bottom: HEIGHT / 6,
        left: WIDTH / 8
      },
      animated: true
    })
  }, [riderLiveLocation, destinationCoordinate])

  useEffect(() => {
    props?.navigation.setOptions({
      headerRight: () => HelpButton({ iconBackground: currentTheme.main, navigation, t }),
      headerTitle: `${order ? order?.deliveryAddress?.deliveryAddress?.substr(0, 15) : ''}...`,
      headerTitleStyle: { color: currentTheme.newFontcolor },
      headerStyle: { backgroundColor: currentTheme.newheaderBG }
    })
  }, [orders])

  const [remainingTimeState, setRemainingTimeState] = useState(0)

  useEffect(() => {
    if (order && ![ORDER_STATUS_ENUM.DELIVERED, ORDER_STATUS_ENUM.CANCELLED, ORDER_STATUS_ENUM.CANCELLEDBYREST].includes(order.orderStatus)) {
      const initialTime = calulateRemainingTime(order)
      setRemainingTimeState(initialTime)

      const intervalId = setInterval(() => {
        const updatedTime = calulateRemainingTime(order)
        setRemainingTimeState(updatedTime)

        if (updatedTime <= 0 || [ORDER_STATUS_ENUM.DELIVERED, ORDER_STATUS_ENUM.CANCELLED, ORDER_STATUS_ENUM.CANCELLEDBYREST].includes(order.orderStatus)) {
          clearInterval(intervalId)
        }
      }, 5000)

      return () => clearInterval(intervalId)
    }
  }, [order])

  if (loadingOrders) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: currentTheme.themeBackground }}>
        <LottieView
          style={{ width: scale(160), height: scale(160) }}
          source={require('../../assets/SVG/ShiimerImagePlaceholder.json')}
          autoPlay
          loop
        />
        <TextDefault H5 textColor={currentTheme.gray600} center style={{ ...alignment.MTsmall }}>
          {t('gettingOrderDetails', 'Getting your order details...')}
        </TextDefault>
      </View>
    )
  }
  if (errorOrders) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: currentTheme.themeBackground, ...alignment.Pmedium }}>
        <LottieView
          style={{ width: scale(200), height: scale(200) }}
          source={require('../../assets/SVG/ItemUnavailable.json')}
          autoPlay
          loop
        />
        <TextDefault H4 bolder textColor={currentTheme.gray900} center style={{ ...alignment.MTsmall }}>
          {t('somethingWentWrong', 'Something went wrong')}
        </TextDefault>
        <TextDefault H5 textColor={currentTheme.gray600} center style={{ ...alignment.MTxSmall }}>
          {t('orderDetailsErrorMessage', "We couldn't load your order details. Please try again.")}
        </TextDefault>
      </View>
    )
  }

  if (!order) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: currentTheme.themeBackground, ...alignment.Pmedium }}>
        <LottieView
          style={{ width: scale(200), height: scale(200) }}
          source={require('../../assets/SVG/ItemUnavailable.json')}
          autoPlay
          loop
        />
        <TextDefault H4 bolder textColor={currentTheme.gray900} center style={{ ...alignment.MTsmall }}>
          {t('orderNotFound', 'Order not found')}
        </TextDefault>
        <TextDefault H5 textColor={currentTheme.gray600} center style={{ ...alignment.MTxSmall }}>
          {t('orderNotFoundMessage', "We couldn't find this order. It may have been removed.")}
        </TextDefault>
        <View style={{ ...alignment.MTmedium }}>
          <Button
            text={t('backToHome', 'Back to home')}
            buttonProps={{ onPress: () => navigation.navigate('Main') }}
            buttonStyles={{ ...styles().cancelButtonContainer(currentTheme), backgroundColor: currentTheme.main, borderColor: currentTheme.main }}
            textProps={{ textColor: currentTheme.white }}
            textStyles={{ ...alignment.Pmedium }}
          />
        </View>
      </View>
    )
  }

  const { _id, restaurant, deliveryAddress, items, tipping: tip, taxationAmount: tax, orderAmount: total, deliveryCharges, discountAmount, serviceFee = 0 } = order

  const subTotal = total - tip - tax - deliveryCharges - serviceFee
  const moneyOptions = {
    suffix: configuration?.currency,
    decimals: configuration?.currencyDecimalDigits ?? 2
  }
  const totalAmount = formatMoneyModel(order?.orderAmountMoney, total, moneyOptions)

  const isOrderCancelable = [ORDER_STATUS_ENUM.PENDING, ORDER_STATUS_ENUM.ACCEPTED].includes(order?.orderStatus)
  const isRiderTrackable = [ORDER_STATUS_ENUM.ASSIGNED, ORDER_STATUS_ENUM.PICKED, ORDER_STATUS_ENUM.ARRIVED].includes(order?.orderStatus)

  // Presentational-only proximity cue for the ASSIGNED status copy (StatusHero) —
  // not a new backend status, just derived from the already-tracked live rider fix.
  const restaurantCoordinate = restaurant?.location?.coordinates
    ? { latitude: +restaurant.location.coordinates[1], longitude: +restaurant.location.coordinates[0] }
    : null
  const riderDistanceToRestaurantMeters =
    riderLiveLocation && restaurantCoordinate
      ? haversineDistanceMeters({ latitude: riderLiveLocation.latitude, longitude: riderLiveLocation.longitude }, restaurantCoordinate)
      : null

  if (!connect) return <ErrorView refetchFunctions={[]} />

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          backgroundColor: currentTheme.themeBackground,
          paddingBottom: scale(150)
        }}
        showsVerticalScrollIndicator={false}
        overScrollMode='never'
      >
        {order?.rider && isRiderTrackable && (
          <View style={{ height: HEIGHT * 0.6 }}>
          <MapView
            ref={(c) => (mapView.current = c)}
            style={{ flex: 1, height: HEIGHT * 0.6 }}
            showsUserLocation={false}
            initialRegion={{
              latitude: +deliveryAddress?.location?.coordinates[1],
              longitude: +deliveryAddress?.location?.coordinates[0],
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421
            }}
            zoomEnabled={true}
            zoomControlEnabled={true}
            rotateEnabled={false}
            customMapStyle={mapStyle}
            provider={PROVIDER_DEFAULT}
            // A manual pan/drag means the user wants control of the camera —
            // stop auto-following until they tap "Recenter". Present on both
            // native react-native-maps and the web stub (@teovilla).
            onPanDrag={() => setAutoFollow(false)}
          >
            <Marker
              coordinate={{
                longitude: +restaurant?.location?.coordinates[0],
                latitude: +restaurant?.location?.coordinates[1]
              }}
            >
              <RestaurantMarker />
            </Marker>
            <Marker
              coordinate={{
                latitude: +deliveryAddress?.location?.coordinates[1],
                longitude: +deliveryAddress?.location?.coordinates[0]
              }}
            >
              <PulsingMarker color={currentTheme.main}>
                <CustomerMarker />
              </PulsingMarker>
            </Marker>
            <MapViewDirections
              origin={
                directionsOrigin || {
                  longitude: +restaurant?.location?.coordinates[0],
                  latitude: +restaurant?.location?.coordinates[1]
                }
              }
              destination={{
                latitude: +deliveryAddress?.location?.coordinates[1],
                longitude: +deliveryAddress?.location?.coordinates[0]
              }}
              apikey={GOOGLE_MAPS_KEY}
              strokeWidth={6}
              strokeColor={currentTheme.main}
              optimizeWaypoints={true}
              onReady={(result) => {
                // Only auto-fit once, on the initial route load. After that,
                // the camera-follow logic driven by rider fixes (see
                // handleRiderLocationChange) owns re-fitting, so a periodic
                // route refresh doesn't fight the user's own pan/zoom.
                if (initialFitDoneRef.current) return
                initialFitDoneRef.current = true
                lastFitAtRef.current = Date.now()
                safeFitToCoordinates(mapView, result.coordinates, {
                  edgePadding: {
                    right: WIDTH / 20,
                    bottom: HEIGHT / 20,
                    left: WIDTH / 20,
                    top: HEIGHT / 20
                  },
                  animated: true
                })
              }}
              onError={(error) => {
                console.log('onerror', error)
              }}
            />
            {order?.rider && (
              <TrackingRider
                orderId={_id}
                onStatusChange={setRiderStatusLabel}
                onLocationChange={handleRiderLocationChange}
              />
            )}
          </MapView>
          {!autoFollow && (
            <TouchableOpacity
              accessibilityRole='button'
              accessibilityLabel={t('recenterMap', 'Recenter map on rider')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles().recenterButton(currentTheme)}
              onPress={handleRecenter}
            >
              <Ionicons name='locate' size={scale(20)} color={currentTheme.white} />
            </TouchableOpacity>
          )}
          </View>
        )}
        {order?.rider && isRiderTrackable && (
          <TrackingBottomSheet
            theme={currentTheme}
            rider={order.rider}
            remainingTimeLabel={`${remainingTimeState}-${remainingTimeState + 5} ${t('mins')}`}
            statusLabel={riderStatusLabel}
            onChatPress={() =>
              props?.navigation.navigate('ChatWithRider', {
                id,
                orderNo: order?.orderId,
                total,
                riderPhone: order?.rider?.phone
              })
            }
          />
        )}
        <StatusHero
          order={order}
          theme={currentTheme}
          remainingTime={remainingTimeState}
          showEta={!(order?.rider && isRiderTrackable)}
          riderDistanceToRestaurantMeters={riderDistanceToRestaurantMeters}
        />
        <View style={{ ...alignment.PLmedium, ...alignment.PRmedium }}>
          <OrderTimeline order={order} theme={currentTheme} />
        </View>
        <Instructions title={'Instructions'} theme={currentTheme} message={order?.instructions} />
        <Detail navigation={props?.navigation} currencySymbol={configuration.currencySymbol} items={items} from={restaurant?.name} restaurantImage={restaurant?.image} paymentMethod={order?.paymentMethod} orderNo={order?.orderId} deliveryAddress={deliveryAddress?.deliveryAddress} subTotal={subTotal} tip={tip} tax={tax} deliveryCharges={deliveryCharges} total={total} theme={currentTheme} id={id} rider={order?.rider} orderStatus={order?.orderStatus} />
        <Taxes
          tax={tax}
          deliveryCharges={deliveryCharges}
          tip={tip}
          discountAmount={discountAmount}
          serviceFee={serviceFee}
          taxationAmountMoney={order?.taxationAmountMoney}
          deliveryChargesMoney={order?.deliveryChargesMoney}
          tippingMoney={order?.tippingMoney}
          discountAmountMoney={order?.discountAmountMoney}
          serviceFeeMoney={order?.serviceFeeMoney}
          currencyCode={configuration?.currency}
          decimals={configuration?.currencyDecimalDigits ?? 2}
        />
      </ScrollView>
      <View style={styles().bottomContainer(currentTheme)}>
        {/* Tip is not showing on the tracking page
        {tip > 0 && (
  <PriceRow
    theme={currentTheme}
    title={t('tip')}   // uses translation
    currency={configuration.currencySymbol}
    price={tip.toFixed(2)}
  />
)} */}

        <PriceRow theme={currentTheme} title={t('total')} currency='' price={totalAmount} />

        {[ORDER_STATUS_ENUM.PICKED, ORDER_STATUS_ENUM.ARRIVED].includes(order?.orderStatus) && !order?.customerDeliveredAt && (
          <View style={{ marginHorizontal: scale(20), marginTop: scale(10) }}>
            <Button
              disabled={loadingConfirm}
              text={loadingConfirm ? t('loading') : t('iReceivedMyOrder')}
              buttonProps={{ onPress: () => markOrderDelivered() }}
              buttonStyles={{ ...styles().cancelButtonContainer(currentTheme), backgroundColor: currentTheme.main, borderColor: currentTheme.main }}
              textProps={{ textColor: currentTheme.white }}
              textStyles={{ ...alignment.Pmedium }}
            />
          </View>
        )}

        {isOrderCancelable && (
          <View style={{ margin: scale(20) }}>
            <Button text={t('cancelOrder')} buttonProps={{ onPress: cancelModalToggle }} buttonStyles={styles().cancelButtonContainer(currentTheme)} textProps={{ textColor: currentTheme.red600 }} textStyles={{ ...alignment.Pmedium }} />
          </View>
        )}

      </View>
      <CancelModal theme={currentTheme} modalVisible={cancelModalVisible} setModalVisible={cancelModalToggle} cancelOrder={cancelOrder} loading={loadingCancel} orderStatus={order?.orderStatus} />
    </View>
  )
}

export default OrderDetail
