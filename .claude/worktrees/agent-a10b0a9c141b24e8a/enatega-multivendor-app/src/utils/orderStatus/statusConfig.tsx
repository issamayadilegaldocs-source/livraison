import type { ComponentProps } from 'react'
import type { Ionicons } from '@expo/vector-icons'
import type { AnimationObject } from 'lottie-react-native'
import { ORDER_STATUS_ENUM } from '../enums'

export type OrderStatusValue = (typeof ORDER_STATUS_ENUM)[keyof typeof ORDER_STATUS_ENUM]
export type IoniconName = ComponentProps<typeof Ionicons>['name']

// Presentational accent colors, independent of the light/dark theme palette in
// themeColors.js (which has no purple/indigo/teal tokens) — status color is a
// fixed semantic meaning (e.g. "preparing = orange"), not a theme-dependent one.
export const STATUS_ACCENT_COLORS = {
  blue: '#3B82F6',
  orange: '#FFA921',
  purple: '#8B5CF6',
  indigo: '#6366F1',
  teal: '#14B8A6',
  green: '#22C55E',
  red: '#DC2626'
} as const

export type StatusVisual =
  | { kind: 'lottie'; source: AnimationObject }
  | { kind: 'lottieWithBagAccessory'; source: AnimationObject }
  | { kind: 'radarPulse' }
  | { kind: 'assignedBounce' }
  | { kind: 'lottieWithBell'; source: AnimationObject }
  | { kind: 'lottieWithConfetti'; source: AnimationObject }
  | { kind: 'cancelledFade' }

export interface OrderStatusConfigEntry {
  color: string
  titleKey: string
  defaultTitle: string
  subtitleKey: string | null
  defaultSubtitle: string
  visual: StatusVisual
  timelineIcon: IoniconName
  /** Index into the 6-stage collapsed timeline (placed/preparing/assigned/pickedUp/arrived/delivered). null = timeline hidden (cancelled). */
  timelineStageIndex: number | null
  /** Legacy 1-8 scale, kept identical to the old ProgressBar `orderStatuses` mapping so the active-orders list progress fraction doesn't change. */
  progressStage: number
}

export const ASSIGNED_AT_RESTAURANT_THRESHOLD_METERS = 120

export const ORDER_STATUS_CONFIG: Record<OrderStatusValue, OrderStatusConfigEntry> = {
  [ORDER_STATUS_ENUM.PENDING]: {
    color: STATUS_ACCENT_COLORS.blue,
    titleKey: 'orderStatusTitlePending',
    defaultTitle: 'Order received',
    subtitleKey: 'pendingOrder',
    defaultSubtitle:
      "Order received! We are now waiting for the store to accept your order. You will be notified as soon as it's confirmed.",
    visual: { kind: 'lottie', source: require('../../assets/SVG/order-placed.json') },
    timelineIcon: 'receipt-outline',
    timelineStageIndex: 0,
    progressStage: 1
  },
  [ORDER_STATUS_ENUM.ACCEPTED]: {
    color: STATUS_ACCENT_COLORS.orange,
    titleKey: 'orderStatusTitleAccepted',
    defaultTitle: 'Your meal is being prepared',
    subtitleKey: 'acceptedOrder',
    defaultSubtitle: 'Preparing your food. Will be delivered very soon.',
    visual: { kind: 'lottie', source: require('../../assets/SVG/order-tracking-preparing.json') },
    timelineIcon: 'restaurant-outline',
    timelineStageIndex: 1,
    progressStage: 2
  },
  [ORDER_STATUS_ENUM.PREPARED]: {
    color: STATUS_ACCENT_COLORS.orange,
    titleKey: 'orderStatusTitlePrepared',
    defaultTitle: 'Order ready, packing it up',
    subtitleKey: 'preparedOrder',
    defaultSubtitle: 'Your food is ready! A rider is on their way to pick it up.',
    visual: { kind: 'lottieWithBagAccessory', source: require('../../assets/SVG/place-order.json') },
    timelineIcon: 'bag-check-outline',
    timelineStageIndex: 1,
    progressStage: 3
  },
  [ORDER_STATUS_ENUM.AWAITING_RIDER]: {
    color: STATUS_ACCENT_COLORS.purple,
    titleKey: 'orderStatusTitleAwaitingRider',
    defaultTitle: 'Finding you a rider',
    subtitleKey: 'awaitingRiderOrder',
    defaultSubtitle: "We're finding the best available rider for your order.",
    visual: { kind: 'radarPulse' },
    timelineIcon: 'bicycle-outline',
    timelineStageIndex: 1,
    progressStage: 3
  },
  [ORDER_STATUS_ENUM.ASSIGNED]: {
    color: STATUS_ACCENT_COLORS.indigo,
    titleKey: 'orderStatusTitleAssigned',
    defaultTitle: 'Rider assigned',
    // Resolved dynamically by getOrderStatusMeta() based on rider proximity to the restaurant.
    subtitleKey: 'orderStatusSubtitleAssignedHeading',
    defaultSubtitle: 'A rider is heading to the restaurant',
    visual: { kind: 'assignedBounce' },
    timelineIcon: 'bicycle',
    timelineStageIndex: 2,
    progressStage: 4
  },
  [ORDER_STATUS_ENUM.PICKED]: {
    color: STATUS_ACCENT_COLORS.teal,
    titleKey: 'orderStatusTitlePicked',
    defaultTitle: 'Your order is on the scooter',
    subtitleKey: 'pickedOrder',
    defaultSubtitle: 'Your rider has picked up the order. Get ready for some delicious food!',
    visual: { kind: 'lottie', source: require('../../assets/SVG/food-picked.json') },
    timelineIcon: 'fast-food-outline',
    timelineStageIndex: 3,
    progressStage: 5
  },
  [ORDER_STATUS_ENUM.ARRIVED]: {
    color: STATUS_ACCENT_COLORS.green,
    titleKey: 'orderStatusTitleArrived',
    defaultTitle: 'Your rider is almost there',
    subtitleKey: 'arrivedOrder',
    defaultSubtitle: 'Your rider has arrived. Meet them to collect your order!',
    visual: { kind: 'lottieWithBell', source: require('../../assets/SVG/location.json') },
    timelineIcon: 'location-outline',
    timelineStageIndex: 4,
    progressStage: 6
  },
  [ORDER_STATUS_ENUM.DELIVERED]: {
    color: STATUS_ACCENT_COLORS.green,
    titleKey: 'orderStatusTitleDelivered',
    defaultTitle: 'Delivered! Enjoy your meal',
    subtitleKey: 'deliveredOrder',
    defaultSubtitle: 'Order is delivered.',
    visual: { kind: 'lottieWithConfetti', source: require('../../assets/SVG/order-delivered.json') },
    timelineIcon: 'checkmark-done-outline',
    timelineStageIndex: 5,
    progressStage: 7
  },
  [ORDER_STATUS_ENUM.COMPLETED]: {
    color: STATUS_ACCENT_COLORS.green,
    titleKey: 'orderStatusTitleDelivered',
    defaultTitle: 'Delivered! Enjoy your meal',
    subtitleKey: 'completedOrder',
    defaultSubtitle: 'Order is completed.',
    visual: { kind: 'lottieWithConfetti', source: require('../../assets/SVG/order-delivered.json') },
    timelineIcon: 'checkmark-done-outline',
    timelineStageIndex: 5,
    progressStage: 8
  },
  [ORDER_STATUS_ENUM.CANCELLED]: {
    color: STATUS_ACCENT_COLORS.red,
    titleKey: 'orderStatusTitleCancelled',
    defaultTitle: 'Order cancelled',
    subtitleKey: 'cancelledOrder',
    defaultSubtitle: 'Your order is cancelled. If you have any questions, please reach out to our support team.',
    visual: { kind: 'cancelledFade' },
    timelineIcon: 'close-circle-outline',
    timelineStageIndex: null,
    progressStage: 8
  },
  [ORDER_STATUS_ENUM.CANCELLEDBYREST]: {
    color: STATUS_ACCENT_COLORS.red,
    titleKey: 'orderStatusTitleCancelled',
    defaultTitle: 'Order cancelled',
    subtitleKey: 'cancelledOrder',
    defaultSubtitle: 'Your order is cancelled. If you have any questions, please reach out to our support team.',
    visual: { kind: 'cancelledFade' },
    timelineIcon: 'close-circle-outline',
    timelineStageIndex: null,
    progressStage: 8
  }
}

export const ORDER_STATUS_KEYS = Object.keys(ORDER_STATUS_CONFIG) as OrderStatusValue[]

export interface OrderStatusMeta extends OrderStatusConfigEntry {
  defaultSubtitleKey: string
}

export interface GetOrderStatusMetaOptions {
  riderDistanceToRestaurantMeters?: number | null
}

/**
 * Resolves the display config for a status, including the ASSIGNED
 * proximity-derived subtitle (presentational only — no new backend status).
 */
export function getOrderStatusMeta(
  status: string | null | undefined,
  options: GetOrderStatusMetaOptions = {}
): OrderStatusMeta | null {
  const entry = status ? ORDER_STATUS_CONFIG[status as OrderStatusValue] : undefined
  if (!entry) return null

  if (status === ORDER_STATUS_ENUM.ASSIGNED) {
    const distance = options.riderDistanceToRestaurantMeters
    const isAtRestaurant = distance != null && Number.isFinite(distance) && distance <= ASSIGNED_AT_RESTAURANT_THRESHOLD_METERS
    return {
      ...entry,
      subtitleKey: isAtRestaurant ? 'orderStatusSubtitleAssignedAtRestaurant' : 'orderStatusSubtitleAssignedHeading',
      defaultSubtitle: isAtRestaurant
        ? 'Your rider is at the restaurant, picking up your order'
        : 'A rider is heading to the restaurant',
      defaultSubtitleKey: entry.subtitleKey ?? 'orderStatusSubtitleAssignedHeading'
    }
  }

  return { ...entry, defaultSubtitleKey: entry.subtitleKey ?? entry.titleKey }
}

export function isCancelledStatus(status: string | null | undefined): boolean {
  return status === ORDER_STATUS_ENUM.CANCELLED || status === ORDER_STATUS_ENUM.CANCELLEDBYREST
}

export function isDeliveredLikeStatus(status: string | null | undefined): boolean {
  return status === ORDER_STATUS_ENUM.DELIVERED || status === ORDER_STATUS_ENUM.COMPLETED
}
