import React, { useEffect, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import TextDefault from '../../Text/TextDefault/TextDefault'
import { scale } from '../../../utils/scaling'
import { ORDER_STATUS_ENUM } from '../../../utils/enums'
import type { ThemeColors } from '../../../types/theme'

const ROTATE_INTERVAL_MS = 4000

const PREPARING_MESSAGE_KEYS = [
  'waitingMessagePreparing1',
  'waitingMessagePreparing2',
  'waitingMessagePreparing3',
  'waitingMessagePreparing4'
]

const AWAITING_RIDER_MESSAGE_KEYS = [
  'waitingMessageAwaitingRider1',
  'waitingMessageAwaitingRider2',
  'waitingMessageAwaitingRider3'
]

const DEFAULT_MESSAGES: Record<string, string> = {
  waitingMessagePreparing1: 'The chef is preparing everything with care.',
  waitingMessagePreparing2: 'Fresh ingredients are being prepared.',
  waitingMessagePreparing3: 'Packing your order.',
  waitingMessagePreparing4: 'One more minute.',
  waitingMessageAwaitingRider1: "We're matching you with the best rider nearby.",
  waitingMessageAwaitingRider2: 'Almost there — finding your rider.',
  waitingMessageAwaitingRider3: 'Your rider will be assigned any moment now.'
}

interface WaitingMessagesProps {
  status: string | null | undefined
  theme: ThemeColors
}

const WaitingMessages = ({ status, theme }: WaitingMessagesProps) => {
  const { t } = useTranslation()
  const messageKeys = useMemo(
    () => (status === ORDER_STATUS_ENUM.AWAITING_RIDER ? AWAITING_RIDER_MESSAGE_KEYS : PREPARING_MESSAGE_KEYS),
    [status]
  )
  const [index, setIndex] = useState(0)
  const opacity = useSharedValue(1)

  useEffect(() => {
    setIndex(0)
  }, [messageKeys])

  useEffect(() => {
    if (messageKeys.length <= 1) return undefined
    const intervalId = setInterval(() => {
      opacity.value = withTiming(0, { duration: 250 }, (finished) => {
        if (finished) {
          opacity.value = withTiming(1, { duration: 250 })
        }
      })
      setTimeout(() => {
        setIndex((current) => (current + 1) % messageKeys.length)
      }, 250)
    }, ROTATE_INTERVAL_MS)
    return () => clearInterval(intervalId)
  }, [messageKeys, opacity])

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  const key = messageKeys[index]

  return (
    <View style={styles.container}>
      <Animated.View style={animatedStyle}>
        <TextDefault small textColor={theme.gray500} center>
          {t(key, DEFAULT_MESSAGES[key])}
        </TextDefault>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginTop: scale(6),
    minHeight: scale(18)
  }
})

export default WaitingMessages
