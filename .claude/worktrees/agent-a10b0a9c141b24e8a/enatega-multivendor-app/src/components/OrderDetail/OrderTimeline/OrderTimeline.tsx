import React, { useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import TextDefault from '../../Text/TextDefault/TextDefault'
import { scale } from '../../../utils/scaling'
import { ORDER_STATUS_ENUM } from '../../../utils/enums'
import { ORDER_STATUS_CONFIG, getOrderStatusMeta, isCancelledStatus, type IoniconName } from '../../../utils/orderStatus/statusConfig'
import { formatStatusTime } from '../../../utils/orderStatus/formatStatusTime'
import type { ThemeColors } from '../../../types/theme'

interface StatusHistoryEntry {
  status: string
  at: string
  actor?: string | null
}

export interface OrderTimelineOrder {
  orderStatus: string
  createdAt?: string | null
  acceptedAt?: string | null
  preparedAt?: string | null
  assignedAt?: string | null
  pickedAt?: string | null
  arrivedAt?: string | null
  deliveredAt?: string | null
  customerDeliveredAt?: string | null
  statusHistory?: StatusHistoryEntry[] | null
}

type TimelineTheme = ThemeColors & { isRTL?: boolean }

interface Props {
  order: OrderTimelineOrder
  theme: TimelineTheme
}

interface Stage {
  key: string
  titleKey: string
  defaultTitle: string
  descKey: string
  defaultDesc: string
  icon: IoniconName
  color: string
  matchStatuses: string[]
  fallbackField: keyof OrderTimelineOrder
}

// Six customer-facing stages — several real statuses (see ORDER_STATUS_ENUM)
// collapse into "Preparing" so the timeline stays readable. Icon/color are
// sourced from the central status config, not duplicated here.
const STAGES: Stage[] = [
  {
    key: 'placed',
    titleKey: 'timelineOrderPlaced',
    defaultTitle: 'Order placed',
    descKey: 'timelineOrderPlacedDesc',
    defaultDesc: "We've received your order.",
    icon: ORDER_STATUS_CONFIG[ORDER_STATUS_ENUM.PENDING].timelineIcon,
    color: ORDER_STATUS_CONFIG[ORDER_STATUS_ENUM.PENDING].color,
    matchStatuses: [ORDER_STATUS_ENUM.PENDING],
    fallbackField: 'createdAt'
  },
  {
    key: 'preparing',
    titleKey: 'timelinePreparing',
    defaultTitle: 'Preparing',
    descKey: 'timelinePreparingDesc',
    defaultDesc: 'The restaurant is preparing your food.',
    icon: ORDER_STATUS_CONFIG[ORDER_STATUS_ENUM.ACCEPTED].timelineIcon,
    color: ORDER_STATUS_CONFIG[ORDER_STATUS_ENUM.ACCEPTED].color,
    matchStatuses: [ORDER_STATUS_ENUM.ACCEPTED, ORDER_STATUS_ENUM.PREPARED, ORDER_STATUS_ENUM.AWAITING_RIDER],
    fallbackField: 'acceptedAt'
  },
  {
    key: 'assigned',
    titleKey: 'timelineRiderAssigned',
    defaultTitle: 'Rider assigned',
    descKey: 'timelineRiderAssignedDesc',
    defaultDesc: 'A rider has been assigned to deliver your order.',
    icon: ORDER_STATUS_CONFIG[ORDER_STATUS_ENUM.ASSIGNED].timelineIcon,
    color: ORDER_STATUS_CONFIG[ORDER_STATUS_ENUM.ASSIGNED].color,
    matchStatuses: [ORDER_STATUS_ENUM.ASSIGNED],
    fallbackField: 'assignedAt'
  },
  {
    key: 'pickedUp',
    titleKey: 'timelinePickedUp',
    defaultTitle: 'Picked up',
    descKey: 'timelinePickedUpDesc',
    defaultDesc: 'Your rider picked up the order.',
    icon: ORDER_STATUS_CONFIG[ORDER_STATUS_ENUM.PICKED].timelineIcon,
    color: ORDER_STATUS_CONFIG[ORDER_STATUS_ENUM.PICKED].color,
    matchStatuses: [ORDER_STATUS_ENUM.PICKED],
    fallbackField: 'pickedAt'
  },
  {
    key: 'arrived',
    titleKey: 'timelineArrived',
    defaultTitle: 'Rider arrived',
    descKey: 'timelineArrivedDesc',
    defaultDesc: 'Your rider has arrived at your location.',
    icon: ORDER_STATUS_CONFIG[ORDER_STATUS_ENUM.ARRIVED].timelineIcon,
    color: ORDER_STATUS_CONFIG[ORDER_STATUS_ENUM.ARRIVED].color,
    matchStatuses: [ORDER_STATUS_ENUM.ARRIVED],
    fallbackField: 'arrivedAt'
  },
  {
    key: 'delivered',
    titleKey: 'timelineDelivered',
    defaultTitle: 'Delivered',
    descKey: 'timelineDeliveredDesc',
    defaultDesc: 'Order delivered successfully.',
    icon: ORDER_STATUS_CONFIG[ORDER_STATUS_ENUM.DELIVERED].timelineIcon,
    color: ORDER_STATUS_CONFIG[ORDER_STATUS_ENUM.DELIVERED].color,
    matchStatuses: [ORDER_STATUS_ENUM.DELIVERED, ORDER_STATUS_ENUM.COMPLETED],
    fallbackField: 'deliveredAt'
  }
]

function resolveStageTime(order: OrderTimelineOrder, stage: Stage): string | null {
  const historyEntries = (order.statusHistory ?? []).filter((entry) => stage.matchStatuses.includes(entry.status))
  if (historyEntries.length > 0) {
    const earliest = historyEntries.reduce((a, b) => (new Date(a.at).getTime() <= new Date(b.at).getTime() ? a : b))
    return earliest.at
  }
  const fallback = order[stage.fallbackField]
  return typeof fallback === 'string' ? fallback : null
}

const OrderTimeline = ({ order, theme }: Props) => {
  const { t } = useTranslation()

  if (isCancelledStatus(order?.orderStatus)) return null

  const activeIndex = getOrderStatusMeta(order?.orderStatus)?.timelineStageIndex ?? 0

  return (
    <View style={styles.container}>
      {STAGES.map((stage, index) => (
        <TimelineRow
          key={stage.key}
          stage={stage}
          time={resolveStageTime(order, stage)}
          active={index <= activeIndex}
          current={index === activeIndex}
          isLast={index === STAGES.length - 1}
          theme={theme}
          t={t}
        />
      ))}
    </View>
  )
}

interface TimelineRowProps {
  stage: Stage
  time: string | null
  active: boolean
  current: boolean
  isLast: boolean
  theme: TimelineTheme
  t: TFunction
}

const TimelineRow = ({ stage, time, active, current, isLast, theme, t }: TimelineRowProps) => {
  const pulse = useSharedValue(current ? 1 : 0.85)

  useEffect(() => {
    pulse.value = withTiming(current ? 1.15 : 1, { duration: 350 })
  }, [current, pulse])

  const dotStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }))
  const timeLabel = formatStatusTime(time)
  const isRTL = !!theme?.isRTL

  return (
    <View style={[styles.row, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      <View style={styles.iconColumn}>
        <Animated.View
          style={[
            styles.iconCircle,
            dotStyle,
            {
              backgroundColor: active ? stage.color : theme.gray200,
              borderColor: current ? stage.color : 'transparent'
            }
          ]}
        >
          <Ionicons name={stage.icon} size={scale(16)} color={active ? '#FFFFFF' : theme.gray500} />
        </Animated.View>
        {!isLast && <View style={[styles.connector, { backgroundColor: active ? stage.color : theme.gray200 }]} />}
      </View>
      <View style={styles.textColumn}>
        <View style={[styles.titleRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <TextDefault
            H5
            bold={current}
            textColor={active ? theme.gray900 : theme.gray500}
            isRTL
          >
            {t(stage.titleKey, stage.defaultTitle)}
          </TextDefault>
          {!!timeLabel && (
            <TextDefault small textColor={theme.gray500} style={styles.timeLabel}>
              {timeLabel}
            </TextDefault>
          )}
        </View>
        <TextDefault small textColor={theme.gray500} isRTL style={styles.description}>
          {t(stage.descKey, stage.defaultDesc)}
        </TextDefault>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: scale(4)
  },
  row: {
    alignItems: 'flex-start'
  },
  iconColumn: {
    alignItems: 'center',
    width: scale(36)
  },
  iconCircle: {
    width: scale(28),
    height: scale(28),
    borderRadius: scale(14),
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center'
  },
  connector: {
    width: 2,
    flex: 1,
    minHeight: scale(24),
    marginVertical: scale(4)
  },
  textColumn: {
    flex: 1,
    marginHorizontal: scale(10),
    paddingBottom: scale(18)
  },
  titleRow: {
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  timeLabel: {
    marginHorizontal: scale(6)
  },
  description: {
    marginTop: scale(2)
  }
})

export default OrderTimeline
