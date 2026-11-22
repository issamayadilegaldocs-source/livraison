import React, { useEffect } from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated'
import TextDefault from '../../Text/TextDefault/TextDefault'
import { scale } from '../../../utils/scaling'
import { callNumber } from '../../../utils/callNumber'
import PulsingMarker from '../PulsingMarker/PulsingMarker'
import type { ThemeColors } from '../../../types/theme'

interface Rider {
  _id?: string
  name?: string | null
  phone?: string | null
  image?: string | null
  available?: boolean | null
}

// OrderDetail.js builds its `currentTheme` as `{ isRTL, ...theme[value] }` —
// isRTL isn't part of the base ThemeColors color map, so it's added here.
type TrackingTheme = ThemeColors & { isRTL?: boolean }

interface Props {
  theme: TrackingTheme
  rider: Rider
  remainingTimeLabel: string
  statusLabel: string | null
  onChatPress: () => void
}

type Freshness = 'live' | 'updating' | 'unavailable'

// TrackingRider only reports a human-readable status string today (see its
// `statusLabel` memo) rather than a raw freshness enum — derive it here
// instead of widening TrackingRider's own contract for one consumer.
function resolveFreshness(statusLabel: string | null): Freshness {
  if (!statusLabel) return 'live'
  return statusLabel.toLowerCase().includes('unavailable') ? 'unavailable' : 'updating'
}

/**
 * A static, always-visible "bottom sheet"-style card (not a draggable
 * panel — the screen already has a fixed absolute-positioned total/pay bar
 * at the true bottom of the screen, so a second overlapping draggable sheet
 * would fight it). It slides/fades in on mount to read as alive, and sits
 * directly under the live tracking map like Deliveroo's rider card.
 */
const TrackingBottomSheet = ({ theme, rider, remainingTimeLabel, statusLabel, onChatPress }: Props) => {
  const { t } = useTranslation()
  const progress = useSharedValue(0)

  useEffect(() => {
    progress.value = withTiming(1, { duration: 400 })
  }, [progress])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 16 }]
  }))

  const freshness = resolveFreshness(statusLabel)
  const isOnline = rider?.available !== false && freshness !== 'unavailable'
  const presenceColor = !isOnline ? theme.gray500 : freshness === 'updating' ? '#FFA921' : '#22C55E'
  const isStale = statusLabel != null

  return (
    <Animated.View style={[dynamicStyles.card(theme), animatedStyle]}>
      <View style={dynamicStyles.topRow(theme)}>
        <PulsingMarker color={presenceColor} size={scale(56)}>
          <Image
            source={rider?.image ? { uri: rider.image } : require('../../../assets/images/user.png')}
            style={styles.avatar}
            contentFit='cover'
            transition={150}
            cachePolicy='memory-disk'
          />
          <View style={[styles.presenceDot, { backgroundColor: presenceColor, borderColor: theme.cardBackground }]} />
        </PulsingMarker>
        <View style={styles.infoColumn}>
          <TextDefault H5 bolder textColor={theme.gray900} numberOfLines={1}>
            {rider?.name || t('yourRider', 'Your rider')}
          </TextDefault>
          <TextDefault small textColor={isStale ? theme.gray500 : theme.main} bold>
            {statusLabel || t('riderOnTheWay', 'On the way to you')}
          </TextDefault>
        </View>
        <View style={styles.actions}>
          {!!rider?.phone && (
            <TouchableOpacity
              accessibilityRole='button'
              accessibilityLabel={t('callRider', 'Call rider')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={dynamicStyles.actionButton(theme)}
              onPress={() => callNumber(rider.phone as string)}
            >
              <Ionicons name='call-outline' size={scale(18)} color={theme.white} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            accessibilityRole='button'
            accessibilityLabel={t('chatWithRider', "Let's Chat with rider")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[dynamicStyles.actionButton(theme), styles.chatButtonSpacing]}
            onPress={onChatPress}
          >
            <Ionicons name='chatbubble-ellipses-outline' size={scale(18)} color={theme.white} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={dynamicStyles.divider(theme)} />

      <View style={styles.etaRow}>
        <TextDefault small textColor={theme.gray500}>
          {t('estimatedDeliveryTime')}
        </TextDefault>
        <TextDefault H4 bolder textColor={theme.gray900}>
          {remainingTimeLabel}
        </TextDefault>
      </View>
    </Animated.View>
  )
}

const dynamicStyles = {
  card: (theme: TrackingTheme) => ({
    marginHorizontal: scale(16),
    marginTop: -scale(24),
    padding: scale(14),
    borderRadius: scale(18),
    backgroundColor: theme.cardBackground,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 2
  }),
  topRow: (theme: TrackingTheme) => ({
    flexDirection: (theme?.isRTL ? 'row-reverse' : 'row') as 'row' | 'row-reverse',
    alignItems: 'center' as const
  }),
  divider: (theme: TrackingTheme) => ({
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.borderLight,
    marginVertical: scale(10)
  }),
  actionButton: (theme: TrackingTheme) => ({
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    backgroundColor: theme.main,
    alignItems: 'center' as const,
    justifyContent: 'center' as const
  })
}

const styles = StyleSheet.create({
  avatar: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(22)
  },
  presenceDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: scale(13),
    height: scale(13),
    borderRadius: scale(7),
    borderWidth: 2
  },
  infoColumn: {
    flex: 1,
    marginHorizontal: scale(10)
  },
  actions: {
    flexDirection: 'row'
  },
  chatButtonSpacing: {
    marginLeft: scale(8)
  },
  etaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  }
})

export default TrackingBottomSheet
