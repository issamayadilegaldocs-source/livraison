import React, { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import LottieView from 'lottie-react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming
} from 'react-native-reanimated'
import type { StatusVisual as StatusVisualConfig } from '../../../utils/orderStatus/statusConfig'
import { scale } from '../../../utils/scaling'

interface StatusVisualProps {
  visual: StatusVisualConfig
  color: string
  size?: number
  riderImage?: string | null
}

const StatusVisual = ({ visual, color, size = scale(220), riderImage }: StatusVisualProps) => {
  switch (visual.kind) {
    case 'lottie':
      return <LottieView style={{ width: size, height: size }} source={visual.source} autoPlay loop />
    case 'lottieWithBagAccessory':
      return (
        <View style={{ width: size, height: size }}>
          <LottieView style={{ width: size, height: size }} source={visual.source} autoPlay loop />
          <BagCloseAccessory color={color} />
        </View>
      )
    case 'lottieWithBell':
      return (
        <View style={{ width: size, height: size }}>
          <LottieView style={{ width: size, height: size }} source={visual.source} autoPlay loop />
          <BellRingAccessory color={color} />
        </View>
      )
    case 'lottieWithConfetti':
      // The confetti particles are rendered as a screen-wide overlay by
      // StatusHero (via ConfettiBurst), keyed on the DELIVERED/COMPLETED
      // transition — this just plays the delivered animation.
      return <LottieView style={{ width: size, height: size }} source={visual.source} autoPlay loop />
    case 'radarPulse':
      return <RadarPulse color={color} size={size} />
    case 'assignedBounce':
      return <AssignedBounce color={color} size={size} riderImage={riderImage} />
    case 'cancelledFade':
      return <CancelledFade color={color} size={size} />
    default:
      return null
  }
}

const BagCloseAccessory = ({ color }: { color: string }) => {
  const scaleValue = useSharedValue(1.4)

  useEffect(() => {
    scaleValue.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.back(1.5)) })
  }, [scaleValue])

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scaleValue.value }] }))

  return (
    <Animated.View style={[styles.accessoryBadge, animatedStyle, { backgroundColor: color }]}>
      <Ionicons name='bag-outline' size={scale(16)} color='#FFFFFF' />
    </Animated.View>
  )
}

const BellRingAccessory = ({ color }: { color: string }) => {
  const rotation = useSharedValue(0)

  useEffect(() => {
    rotation.value = withRepeat(
      withSequence(
        withTiming(-18, { duration: 120 }),
        withTiming(18, { duration: 120 }),
        withTiming(-12, { duration: 120 }),
        withTiming(12, { duration: 120 }),
        withTiming(0, { duration: 120 }),
        withDelay(1400, withTiming(0, { duration: 1 }))
      ),
      -1,
      false
    )
  }, [rotation])

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ rotateZ: `${rotation.value}deg` }] }))

  return (
    <Animated.View style={[styles.accessoryBadge, animatedStyle, { backgroundColor: color }]}>
      <Ionicons name='notifications-outline' size={scale(16)} color='#FFFFFF' />
    </Animated.View>
  )
}

const RadarPulse = ({ color, size }: { color: string; size: number }) => {
  const ring1 = useSharedValue(0)
  const ring2 = useSharedValue(0)

  useEffect(() => {
    ring1.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.ease) }), -1, false)
    ring2.value = withDelay(600, withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.ease) }), -1, false))
  }, [ring1, ring2])

  const ring1Style = useAnimatedStyle(() => ({
    opacity: 1 - ring1.value,
    transform: [{ scale: 0.4 + ring1.value * 0.8 }]
  }))
  const ring2Style = useAnimatedStyle(() => ({
    opacity: 1 - ring2.value,
    transform: [{ scale: 0.4 + ring2.value * 0.8 }]
  }))

  return (
    <View style={[styles.center, { width: size, height: size }]}>
      <Animated.View style={[styles.ring, ring1Style, { borderColor: color, width: size * 0.6, height: size * 0.6, borderRadius: (size * 0.6) / 2 }]} />
      <Animated.View style={[styles.ring, ring2Style, { borderColor: color, width: size * 0.6, height: size * 0.6, borderRadius: (size * 0.6) / 2 }]} />
      <View style={[styles.iconCircle, { backgroundColor: color }]}>
        <Ionicons name='bicycle' size={scale(36)} color='#FFFFFF' />
      </View>
    </View>
  )
}

const AssignedBounce = ({ color, size, riderImage }: { color: string; size: number; riderImage?: string | null }) => {
  const bounce = useSharedValue(0.4)

  useEffect(() => {
    bounce.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.back(1.8)) })
  }, [bounce])

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: bounce.value }] }))

  return (
    <View style={[styles.center, { width: size, height: size }]}>
      <Animated.View style={[styles.iconCircle, animatedStyle, { backgroundColor: color, width: size * 0.5, height: size * 0.5, borderRadius: (size * 0.5) / 2 }]}>
        {riderImage ? (
          <Image
            source={{ uri: riderImage }}
            style={{ width: size * 0.42, height: size * 0.42, borderRadius: (size * 0.42) / 2 }}
            contentFit='cover'
          />
        ) : (
          <Ionicons name='bicycle' size={scale(40)} color='#FFFFFF' />
        )}
      </Animated.View>
    </View>
  )
}

const CancelledFade = ({ color, size }: { color: string; size: number }) => {
  const opacity = useSharedValue(0)

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 500 })
  }, [opacity])

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return (
    <Animated.View style={[styles.center, animatedStyle, { width: size, height: size }]}>
      <Ionicons name='close-circle-outline' size={size * 0.5} color={color} />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  ring: {
    position: 'absolute',
    borderWidth: 2
  },
  iconCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  accessoryBadge: {
    position: 'absolute',
    bottom: scale(10),
    right: scale(10),
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    alignItems: 'center',
    justifyContent: 'center'
  }
})

export default StatusVisual
