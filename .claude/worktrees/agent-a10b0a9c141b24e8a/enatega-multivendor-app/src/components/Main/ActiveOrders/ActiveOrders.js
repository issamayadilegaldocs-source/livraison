import React, { useContext, useState, useEffect, useRef } from 'react'
import { View, TouchableOpacity, Dimensions, StyleSheet, Animated } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import ConfigurationContext from '../../../context/Configuration'
import ThemeContext from '../../../ui/ThemeContext/ThemeContext'
import { theme } from '../../../utils/themeColors'
import { scale } from '../../../utils/scaling'
import { useNavigation } from '@react-navigation/native'
import TextError from '../../Text/TextError/TextError'
import OrdersContext from '../../../context/Orders'
import { useTranslation } from 'react-i18next'
import TextDefault from '../../Text/TextDefault/TextDefault'
import { Modalize } from 'react-native-modalize'
import { ProgressBar, checkStatus } from './ProgressBar'
import styles from './styles'
import { calulateRemainingTime } from '../../../utils/customFunctions'
import { MaterialIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useBottomTabBarHidden } from '../../../context/BottomTabBarVisibility'
import { floatingTabBarBottom, FLOATING_TAB_BAR_HEIGHT } from '../../../utils/useTabBarSpace'
import { ACTIVE_ORDER_STATUSES } from '../../../utils/enums'

const SCREEN_HEIGHT = Dimensions.get('screen').height
const MODAL_HEIGHT = Math.floor(SCREEN_HEIGHT / 4)
// Breathing room between the top of the floating pill bar and the tracker.
const TRACKER_TAB_BAR_GAP = 12
const MINIMIZED_TRACKER_BOTTOM_OFFSET = 12
const ACTIVE_ORDER_MINIMIZED_STORAGE_KEY = '@activeOrderTrackerMinimized'

const ActiveOrders = ({ onActiveOrdersChange }) => {
  const { t, i18n } = useTranslation()
  const { loadingOrders, errorOrders, orders } = useContext(OrdersContext)
  const configuration = useContext(ConfigurationContext)
  const navigation = useNavigation()
  const tabBarHidden = useBottomTabBarHidden()
  const insets = useSafeAreaInsets()
  const themeContext = useContext(ThemeContext)
  const currentTheme = {
    isRTL: i18n.dir() === 'rtl',
    ...theme[themeContext.ThemeValue]
  }

  const activeOrders = orders.filter(
    (o) =>
      ACTIVE_ORDER_STATUSES.includes(o.orderStatus) &&
      (o?.paymentStatus === 'PAID' || o?.paymentMethod === 'COD')
  )

  const onPressDetails = (order) => {
    navigation.navigate('OrderDetail', {
      _id: order._id,
      order,
      currencySymbol: configuration.currencySymbol
    })
  }

  const [isMinimized, setIsMinimized] = useState(false)
  const [isMinimizedPreferenceLoaded, setIsMinimizedPreferenceLoaded] = useState(false)
  const [justPlacedOrder, setJustPlacedOrder] = useState(false)
  const [showPulse, setShowPulse] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const modalizeRef = useRef(null)
  const pulseAnim = useRef(new Animated.Value(1)).current
  const trackerPositionAnim = useRef(new Animated.Value(tabBarHidden ? 1 : 0)).current
  const timeUpdateInterval = useRef(null)

  const displayOrders = activeOrders.slice(0, 2)
  const activeOrderKey = activeOrders.map((order) => order._id).sort().join('|')

  useEffect(() => {
    Animated.timing(trackerPositionAnim, {
      toValue: tabBarHidden ? 1 : 0,
      duration: 220,
      useNativeDriver: false
    }).start()
  }, [tabBarHidden, trackerPositionAnim])

  useEffect(() => {
    let isMounted = true

    const loadMinimizedPreference = async() => {
      if (!activeOrderKey) {
        setIsMinimizedPreferenceLoaded(true)
        return
      }

      setIsMinimizedPreferenceLoaded(false)
      try {
        const storedValue = await AsyncStorage.getItem(`${ACTIVE_ORDER_MINIMIZED_STORAGE_KEY}:${activeOrderKey}`)
        if (!isMounted) return

        const wasMinimized = storedValue === 'true'
        setIsMinimized(wasMinimized)
        setJustPlacedOrder(wasMinimized)
      } catch {
        if (!isMounted) return
        setIsMinimized(false)
        setJustPlacedOrder(false)
      } finally {
        if (isMounted) {
          setIsMinimizedPreferenceLoaded(true)
        }
      }
    }

    loadMinimizedPreference()

    return () => {
      isMounted = false
    }
  }, [activeOrderKey])

  // Real-time timer update effect
  useEffect(() => {
    if (displayOrders.length > 0) {
      // Update time every 60 seconds for real-time updates
      timeUpdateInterval.current = setInterval(() => {
        setCurrentTime(new Date())
      }, 60000)
    } else {
      if (timeUpdateInterval.current) {
        clearInterval(timeUpdateInterval.current)
        timeUpdateInterval.current = null
      }
    }

    return () => {
      if (timeUpdateInterval.current) {
        clearInterval(timeUpdateInterval.current)
        timeUpdateInterval.current = null
      }
    }
  }, [displayOrders.length])

  useEffect(() => {
    const hasActiveOrders = displayOrders.length > 0
    onActiveOrdersChange(hasActiveOrders)

    // Reset states when no active orders
    if (!hasActiveOrders) {
      setIsMinimized(false)
      setJustPlacedOrder(false)
      if (timeUpdateInterval.current) {
        clearInterval(timeUpdateInterval.current)
        timeUpdateInterval.current = null
      }
      return
    }

    // Auto-minimize after 3 seconds when a new order is detected
    if (hasActiveOrders && !justPlacedOrder) {
      setJustPlacedOrder(true)
      const timer = setTimeout(() => {
        setIsMinimized(true)
        if (activeOrderKey) {
          AsyncStorage.setItem(`${ACTIVE_ORDER_MINIMIZED_STORAGE_KEY}:${activeOrderKey}`, 'true').catch(() => {})
        }
        setShowPulse(true)

        // Start pulse animation
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.1,
              duration: 800,
              useNativeDriver: true
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 800,
              useNativeDriver: true
            })
          ]),
          { iterations: 3 }
        ).start()

        const pulseTimer = setTimeout(() => {
          setShowPulse(false)
        }, 5000)
        return () => clearTimeout(pulseTimer)
      }, 3000)

      return () => clearTimeout(timer)
    }
  }, [displayOrders, onActiveOrdersChange, justPlacedOrder, activeOrderKey])

  const handleMinimize = () => {
    setIsMinimized(true)
    if (activeOrderKey) {
      AsyncStorage.setItem(`${ACTIVE_ORDER_MINIMIZED_STORAGE_KEY}:${activeOrderKey}`, 'true').catch(() => {})
    }
    // Update time immediately when minimizing
    setCurrentTime(new Date())
  }

  const handleExpand = () => {
    setIsMinimized(false)
    if (activeOrderKey) {
      AsyncStorage.removeItem(`${ACTIVE_ORDER_MINIMIZED_STORAGE_KEY}:${activeOrderKey}`).catch(() => {})
    }
    // Update time immediately when expanding
    setCurrentTime(new Date())
  }

  if (loadingOrders) return null
  if (errorOrders && !orders) return <TextError text={errorOrders.message} />
  if (!displayOrders.length) return null
  if (!isMinimizedPreferenceLoaded) return null
  const order = displayOrders[0]

  // Calculate real-time remaining time
  const getRealTimeRemainingTime = (order) => {
    if (!order?.expectedTime) {
      return calulateRemainingTime(order)
    }

    const expectedDeliveryTime = new Date(order.expectedTime)
    if (Number.isNaN(expectedDeliveryTime.getTime())) return calulateRemainingTime(order)
    const now = currentTime
    const timeDiff = expectedDeliveryTime.getTime() - now.getTime()
    const minutesRemaining = Math.max(0, Math.ceil(timeDiff / (1000 * 60)))

    return minutesRemaining
  }

  const remainingTime = getRealTimeRemainingTime(order)
  const modalStyle = {
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: currentTheme.cardBackground
  }
  // Distance from the screen bottom to just above the floating pill bar's top
  // edge. Derived from the bar's own geometry (floatingTabBarBottom + height)
  // — the single source of truth shared with the bar (src/routes/index.js) and
  // useTabBarSpace — so it always tracks the bar's real position instead of a
  // stale magic offset.
  const barTopClearance =
    floatingTabBarBottom(insets.bottom) + FLOATING_TAB_BAR_HEIGHT + TRACKER_TAB_BAR_GAP
  // The floating bar is absolutely positioned and paints over the bottom of
  // this docked sheet. Reserve clearance for it (only while it is visible) so
  // the progress bar and status text are not hidden underneath: grow the docked
  // height so top-pinned content lifts above the bar, and pad the content so the
  // bottom still clears it if the sheet scrolls.
  const tabBarClearance = tabBarHidden ? 0 : barTopClearance
  const minimizedTrackerBottom = trackerPositionAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [barTopClearance, MINIMIZED_TRACKER_BOTTOM_OFFSET]
  })

  // Render minimized tab
  if (isMinimized) {
    return (
      <Animated.View
        style={[
          {
            position: 'absolute',
            bottom: minimizedTrackerBottom,
            left: 0,
            right: 0,
            alignItems: 'center',
            zIndex: 1000,
            transform: [{ scale: showPulse ? pulseAnim : 1 }]
          }
        ]}
      >
        <TouchableOpacity
          style={styles(currentTheme).minimizedTab}
          onPress={handleExpand}
          activeOpacity={0.8}
        >
          <View style={styles(currentTheme).minimizedContent}>
            <View style={styles(currentTheme).trackingDot} />
            <TextDefault
              textColor={currentTheme.white}
              H5
              bold
            >
              {t('orderTracking')}
            </TextDefault>
            <TextDefault textColor={'rgba(255,255,255,0.75)'} H5>
              {'· '}
              {t('Open') || 'Open'}
            </TextDefault>
          </View>
        </TouchableOpacity>
      </Animated.View>
    )
  }

  return (
    <Modalize
      ref={modalizeRef}
      alwaysOpen={MODAL_HEIGHT + tabBarClearance}
      withHandle={false}
      modalHeight={MODAL_HEIGHT + tabBarClearance}
      modalStyle={modalStyle}
    >
      <View style={{ marginTop: scale(20), marginHorizontal: scale(10), paddingBottom: tabBarClearance }}>
        <View
          style={{
            justifyContent: 'space-between',
            flexDirection: currentTheme?.isRTL ? 'row-reverse' : 'row',
            alignItems: 'center'
          }}
        >
          <TextDefault Regular textColor={currentTheme.fontGrayNew}>
            {t('estimatedDeliveryTime')}
          </TextDefault>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              onPress={handleMinimize}
              style={{ marginRight: scale(15) }}
            >
              <MaterialIcons
                name="keyboard-arrow-down"
                size={scale(20)}
                color={currentTheme.gray700}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onPressDetails(order)}>
              <TextDefault textColor={currentTheme.gray700} bolder>
                {t('details')}
              </TextDefault>
            </TouchableOpacity>
          </View>
        </View>
        <View style={{ marginTop: scale(10) }}>
          <TextDefault Regular textColor={currentTheme.gray900} H1 bolder isRTL>
            {remainingTime > 0
              ? `${remainingTime}-${remainingTime + 5} ${t('mins')}`
              : `${t('deliveringSoon')}`
            }
          </TextDefault>
        </View>
        <View>
          <ProgressBar
            configuration={configuration}
            currentTheme={currentTheme}
            item={order}
            navigation={navigation}
            isPicked={order?.isPickedUp}
          />
          <View style={{ marginTop: scale(10) }}>
            <TextDefault
              numberOfLines={2}
              style={styles(currentTheme).statusText}
              isRTL
            >
              {t(checkStatus(order.orderStatus).statusText)}
            </TextDefault>
          </View>
        </View>
      </View>
    </Modalize>
  )
}

export default ActiveOrders
