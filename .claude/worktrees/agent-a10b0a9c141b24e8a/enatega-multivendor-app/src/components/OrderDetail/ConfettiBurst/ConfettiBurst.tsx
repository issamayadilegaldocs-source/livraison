import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Dimensions, StyleSheet, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming
} from 'react-native-reanimated'
import { isDeliveredLikeStatus } from '../../../utils/orderStatus/statusConfig'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

const PARTICLE_COLORS = ['#FFA921', '#3B82F6', '#22C55E', '#EC4899', '#8B5CF6', '#14B8A6']

interface ConfettiBurstProps {
  status: string | null | undefined
  particleCount?: number
}

interface ParticleConfig {
  id: number
  left: number
  rotation: number
  color: string
  delay: number
  fallDistance: number
  size: number
}

/**
 * Fires a one-shot confetti burst only on the transition into a
 * delivered-like status — never on initial mount of an already-delivered
 * order (prevStatusRef seeds with the first-render status, so that case is
 * a no-op).
 */
const ConfettiBurst = ({ status, particleCount = 14 }: ConfettiBurstProps) => {
  const prevStatusRef = useRef(status)
  const [burstId, setBurstId] = useState(0)

  useEffect(() => {
    const previous = prevStatusRef.current
    prevStatusRef.current = status
    if (!isDeliveredLikeStatus(previous) && isDeliveredLikeStatus(status)) {
      setBurstId((id) => id + 1)
    }
  }, [status])

  if (burstId === 0) return null

  return <ConfettiLayer key={burstId} particleCount={particleCount} />
}

const ConfettiLayer = ({ particleCount }: { particleCount: number }) => {
  const particles = useMemo<ParticleConfig[]>(
    () =>
      Array.from({ length: particleCount }).map((_, index) => ({
        id: index,
        left: Math.random() * SCREEN_WIDTH,
        rotation: Math.random() * 360,
        color: PARTICLE_COLORS[index % PARTICLE_COLORS.length],
        delay: Math.random() * 250,
        fallDistance: 180 + Math.random() * 140,
        size: 6 + Math.random() * 6
      })),
    [particleCount]
  )

  return (
    <View style={styles.container} pointerEvents='none'>
      {particles.map((particle) => (
        <ConfettiParticle key={particle.id} config={particle} />
      ))}
    </View>
  )
}

const ConfettiParticle = ({ config }: { config: ParticleConfig }) => {
  const progress = useSharedValue(0)

  useEffect(() => {
    progress.value = withDelay(config.delay, withTiming(1, { duration: 1200 }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [
      { translateY: progress.value * config.fallDistance },
      { translateX: Math.sin(progress.value * Math.PI * 2) * 12 },
      { rotateZ: `${config.rotation + progress.value * 180}deg` }
    ]
  }))

  return (
    <Animated.View
      style={[
        styles.particle,
        animatedStyle,
        {
          left: config.left,
          width: config.size,
          height: config.size,
          backgroundColor: config.color,
          borderRadius: config.size / 4
        }
      ]}
    />
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden'
  },
  particle: {
    position: 'absolute',
    top: 0
  }
})

export default ConfettiBurst
