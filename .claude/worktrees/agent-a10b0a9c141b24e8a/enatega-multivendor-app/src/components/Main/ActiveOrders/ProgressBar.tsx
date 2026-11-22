import React, { useEffect, useRef } from 'react'
import { View, AccessibilityInfo } from 'react-native'
import { useTranslation } from 'react-i18next'
import { scale } from '../../../utils/scaling'
import { ORDER_STATUS_ENUM } from '../../../utils/enums'
import { ORDER_STATUS_KEYS, ORDER_STATUS_CONFIG, getOrderStatusMeta } from '../../../utils/orderStatus/statusConfig'
import AnimatedProgressBar from '../../OrderDetail/AnimatedProgressBar/AnimatedProgressBar'
import type { ThemeColors } from '../../../types/theme'

/**
 * Legacy-shaped helper kept for `ActiveOrders.js` (`t(checkStatus(status).statusText)`)
 * — now sourced from the central status config instead of a local duplicate mapping.
 */
export const checkStatus = (status: string) => {
  const meta = getOrderStatusMeta(status)
  if (!meta) return null
  return { statusText: meta.subtitleKey ?? meta.defaultSubtitleKey }
}

interface ProgressBarProps {
  currentTheme: ThemeColors & { isRTL?: boolean }
  item: { orderStatus: string }
  isPicked?: boolean
}

export const ProgressBar = ({ currentTheme, item, isPicked }: ProgressBarProps) => {
  const { t } = useTranslation()
  // Seed with the current status so we announce only subsequent changes, not
  // the initial mount. Order updates arrive via the global `orderStatusChanged`
  // subscription (OrdersContext) and flow in through the normalized cache.
  const prevStatusRef = useRef(item?.orderStatus)

  useEffect(() => {
    const status = item?.orderStatus
    if (status && status !== prevStatusRef.current) {
      prevStatusRef.current = status
      const meta = getOrderStatusMeta(status)
      if (meta) {
        AccessibilityInfo.announceForAccessibility(t(meta.titleKey, meta.defaultTitle))
      }
    }
  }, [item?.orderStatus, t])

  // Hooks above must run on every render; the early return stays below them so
  // the hook order is stable even when an order becomes cancelled.
  if (item.orderStatus === ORDER_STATUS_ENUM.CANCELLED) return null

  // Excludes ASSIGNED/PICKED once the order has been picked up, matching the
  // pre-redesign behaviour exactly.
  const filteredKeys = isPicked
    ? ORDER_STATUS_KEYS.filter((key) => key !== ORDER_STATUS_ENUM.ASSIGNED && key !== ORDER_STATUS_ENUM.PICKED)
    : ORDER_STATUS_KEYS

  const currentStage = filteredKeys.includes(item.orderStatus as (typeof ORDER_STATUS_KEYS)[number])
    ? ORDER_STATUS_CONFIG[item.orderStatus as keyof typeof ORDER_STATUS_CONFIG].progressStage
    : 0

  const totalBars = isPicked ? 3 : 4
  const progress = Math.min(currentStage, totalBars) / totalBars

  return (
    <View style={{ marginTop: scale(10) }}>
      <AnimatedProgressBar
        progress={progress}
        segments={totalBars}
        color={currentTheme.primary}
        trackColor={currentTheme.gray200}
        isRTL={currentTheme?.isRTL}
      />
    </View>
  )
}
