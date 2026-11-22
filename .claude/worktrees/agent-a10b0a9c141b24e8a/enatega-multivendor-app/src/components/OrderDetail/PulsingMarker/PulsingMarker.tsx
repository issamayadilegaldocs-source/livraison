import React, { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming
} from 'react-native-reanimated'

interface PulsingMarkerProps {
  color?: string
  size?: number
  children: React.ReactNode
}

/**
 * Wraps a marker's icon with a looping scale+opacity halo. Intended for the
 * customer marker only — the restaurant marker is a stationary reference
 * point and stays static.
 */
const PulsingMarker = ({ color = '#3B82F6', size = 56, children }: PulsingMarkerProps) => {
  const pulse = useSharedValue(0)

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.ease) }), -1, false)
  }, [pulse])

  const haloStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.45, 0]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.55, 1.8]) }]
  }))

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View
        style={[styles.halo, haloStyle, { backgroundColor: color, borderRadius: size / 2 }]}
      />
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  halo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0
  }
})

export default PulsingMarker
