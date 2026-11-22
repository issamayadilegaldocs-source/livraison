import React, { useEffect } from 'react'
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue
} from 'react-native-reanimated'
import { scale } from '../../../utils/scaling'

interface AnimatedProgressBarProps {
  /** 0..1 fraction of completion. */
  progress: number
  color: string
  trackColor: string
  /** Renders as N equal-width gapped bars sharing one animated progress value, instead of a single continuous fill. */
  segments?: number
  height?: number
  isRTL?: boolean
  style?: StyleProp<ViewStyle>
}

const AnimatedProgressBar = ({
  progress,
  color,
  trackColor,
  segments = 1,
  height = scale(4),
  isRTL = false,
  style
}: AnimatedProgressBarProps) => {
  const clamped = Math.max(0, Math.min(1, progress))
  const animatedProgress = useSharedValue(0)

  useEffect(() => {
    animatedProgress.value = withTiming(clamped, { duration: 450 })
  }, [clamped, animatedProgress])

  return (
    <View
      style={[styles.row, { flexDirection: isRTL ? 'row-reverse' : 'row' }, style]}
      accessible
      accessibilityRole='progressbar'
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      {Array.from({ length: segments }).map((_, index) => (
        <ProgressSegment
          key={index}
          index={index}
          segments={segments}
          animatedProgress={animatedProgress}
          color={color}
          trackColor={trackColor}
          height={height}
          isLast={index === segments - 1}
        />
      ))}
    </View>
  )
}

interface ProgressSegmentProps {
  index: number
  segments: number
  animatedProgress: SharedValue<number>
  color: string
  trackColor: string
  height: number
  isLast: boolean
}

const ProgressSegment = ({ index, segments, animatedProgress, color, trackColor, height, isLast }: ProgressSegmentProps) => {
  const fillStyle = useAnimatedStyle(() => ({
    width: `${interpolate(
      animatedProgress.value,
      [index / segments, (index + 1) / segments],
      [0, 100],
      Extrapolation.CLAMP
    )}%`
  }))

  return (
    <View
      style={[
        styles.track,
        { backgroundColor: trackColor, height, borderRadius: height / 2 },
        !isLast && styles.segmentGap
      ]}
    >
      <Animated.View style={[styles.fill, fillStyle, { backgroundColor: color, height, borderRadius: height / 2 }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center'
  },
  track: {
    flex: 1,
    overflow: 'hidden'
  },
  segmentGap: {
    marginRight: scale(10)
  },
  fill: {}
})

export default AnimatedProgressBar
