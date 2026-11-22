import React, { useEffect, useRef } from 'react'
import { AccessibilityInfo, StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import TextDefault from '../../Text/TextDefault/TextDefault'
import { scale } from '../../../utils/scaling'
import { alignment } from '../../../utils/alignment'
import { ORDER_STATUS_ENUM } from '../../../utils/enums'
import { getOrderStatusMeta } from '../../../utils/orderStatus/statusConfig'
import StatusVisual from './StatusVisual'
import WaitingMessages from '../WaitingMessages/WaitingMessages'
import ConfettiBurst from '../ConfettiBurst/ConfettiBurst'
import type { ThemeColors } from '../../../types/theme'

type HeroTheme = ThemeColors & { isRTL?: boolean }

interface StatusHeroOrder {
  orderStatus: string
  rider?: { image?: string | null } | null
}

interface StatusHeroProps {
  order: StatusHeroOrder
  theme: HeroTheme
  remainingTime: number
  /** false when the ETA is already shown elsewhere (e.g. the rider tracking card). */
  showEta: boolean
  riderDistanceToRestaurantMeters?: number | null
}

const WAITING_MESSAGE_STATUSES: string[] = [
  ORDER_STATUS_ENUM.ACCEPTED,
  ORDER_STATUS_ENUM.PREPARED,
  ORDER_STATUS_ENUM.AWAITING_RIDER
]

const HIDE_ETA_STATUSES: string[] = [
  ORDER_STATUS_ENUM.PENDING,
  ORDER_STATUS_ENUM.DELIVERED,
  ORDER_STATUS_ENUM.COMPLETED,
  ORDER_STATUS_ENUM.CANCELLED,
  ORDER_STATUS_ENUM.CANCELLEDBYREST
]

const StatusHero = ({ order, theme, remainingTime, showEta, riderDistanceToRestaurantMeters }: StatusHeroProps) => {
  const { t } = useTranslation()
  const status = order?.orderStatus
  const meta = getOrderStatusMeta(status, { riderDistanceToRestaurantMeters })
  const opacity = useSharedValue(0)
  const prevStatusRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    opacity.value = 0
    opacity.value = withTiming(1, { duration: 350 })
  }, [status, opacity])

  useEffect(() => {
    if (!meta) return
    if (prevStatusRef.current && prevStatusRef.current !== status) {
      AccessibilityInfo.announceForAccessibility(t(meta.titleKey, meta.defaultTitle))
    }
    prevStatusRef.current = status
  }, [status, meta, t])

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  if (!meta) return null

  const showWaitingMessages = WAITING_MESSAGE_STATUSES.includes(status)
  const showEtaRow = showEta && Number.isFinite(remainingTime) && !HIDE_ETA_STATUSES.includes(status)
  const showArrivedBadge = status === ORDER_STATUS_ENUM.ARRIVED

  return (
    <View style={styles.container}>
      <ConfettiBurst status={status} />
      <Animated.View style={animatedStyle}>
        <View style={styles.visualWrapper}>
          <StatusVisual visual={meta.visual} color={meta.color} riderImage={order?.rider?.image} />
        </View>

        <TextDefault H2 bolder center textColor={theme.gray900} style={styles.title}>
          {t(meta.titleKey, meta.defaultTitle)}
        </TextDefault>
        <TextDefault H5 center textColor={theme.gray600} style={styles.subtitle}>
          {t(meta.subtitleKey ?? meta.defaultSubtitleKey, meta.defaultSubtitle)}
        </TextDefault>

        {showWaitingMessages && <WaitingMessages status={status} theme={theme} />}

        {showArrivedBadge && (
          <View style={styles.arrivedBadgeWrapper}>
            <View style={[styles.arrivedBadge, { backgroundColor: meta.color }]}>
              <TextDefault textColor='#FFFFFF' bolder small>
                {t('riderArrived')}
              </TextDefault>
            </View>
          </View>
        )}

        {showEtaRow && (
          <View style={styles.etaRow}>
            <TextDefault small textColor={theme.gray500}>
              {t('estimatedDeliveryTime')}
            </TextDefault>
            <TextDefault H3 bolder textColor={meta.color}>
              {remainingTime}-{remainingTime + 5} {t('mins')}
            </TextDefault>
          </View>
        )}
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    ...alignment.Pmedium
  },
  visualWrapper: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: {
    ...alignment.MTsmall
  },
  subtitle: {
    ...alignment.MTxSmall,
    paddingHorizontal: scale(16)
  },
  arrivedBadgeWrapper: {
    alignItems: 'center',
    ...alignment.MTmedium
  },
  arrivedBadge: {
    paddingHorizontal: scale(16),
    paddingVertical: scale(6),
    borderRadius: scale(20)
  },
  etaRow: {
    alignItems: 'center',
    ...alignment.MTmedium
  }
})

export default StatusHero
