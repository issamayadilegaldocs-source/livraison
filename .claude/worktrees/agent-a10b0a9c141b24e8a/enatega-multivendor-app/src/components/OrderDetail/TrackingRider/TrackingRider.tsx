import { useQuery, useSubscription } from '@apollo/client'
import { useIsFocused } from '@react-navigation/native'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Marker } from '../../../lib/maps/MapView'
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming
} from 'react-native-reanimated'

import RiderMarker from '../../../assets/SVG/rider-marker'
import {
  ORDER_RIDER_LOCATION,
  ORDER_RIDER_LOCATION_UPDATED
} from '../../../apollo/tracking'
import { CUSTOMER_TRACKING_CONFIG } from '../../../utils/tracking.config'
import {
  bearingBetween,
  destinationPoint,
  haversineDistanceMeters,
  shortestAngleTarget
} from '../../../utils/geo'

interface RiderLocation {
  orderId: string
  latitude: number
  longitude: number
  accuracyMeters?: number | null
  headingDegrees?: number | null
  speedMetersPerSecond?: number | null
  receivedAt: string
  updateId: string
}

interface QueryData {
  orderRiderLocation: RiderLocation | null
}

interface SubscriptionData {
  orderRiderLocationUpdated: RiderLocation
}

export interface RiderLocationUpdate {
  latitude: number
  longitude: number
  headingDegrees: number | null
  receivedAt: string
}

interface Props {
  orderId: string
  /**
   * Reports the rider-location status so the parent can render an overlay
   * OUTSIDE the MapView. A plain <View> must never be a direct MapView child:
   * on the new architecture react-native-maps treats every child as a map
   * feature and calls native addFeature() on it, which crashes with
   * "The specified child already has a parent".
   */
  onStatusChange?: (label: string | null) => void
  /**
   * Reports every new authoritative rider fix (not intermediate animation
   * frames) so the parent can drive camera-follow / route-refresh without
   * duplicating the query+subscription plumbing.
   */
  onLocationChange?: (location: RiderLocationUpdate) => void
}

type Freshness = 'live' | 'updating' | 'unavailable'

const AnimatedMarker = Animated.createAnimatedComponent(Marker)

const isValidLocation = (location: RiderLocation | null | undefined) =>
  Boolean(
    location &&
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude) &&
    Math.abs(location.latitude) <= 90 &&
    Math.abs(location.longitude) <= 180
  )

const TrackingRider = ({ orderId, onStatusChange, onLocationChange }: Props) => {
  const isFocused = useIsFocused()
  const [location, setLocation] = useState<RiderLocation | null>(null)
  const [freshness, setFreshness] = useState<Freshness>('updating')
  const [isRotating, setIsRotating] = useState(false)
  const latitude = useSharedValue(0)
  const longitude = useSharedValue(0)
  const heading = useSharedValue(0)
  const hasPosition = useRef(false)
  const previousFixRef = useRef<RiderLocation | null>(null)
  const onLocationChangeRef = useRef(onLocationChange)

  useEffect(() => {
    onLocationChangeRef.current = onLocationChange
  }, [onLocationChange])

  const { data, error, loading } = useQuery<QueryData>(ORDER_RIDER_LOCATION, {
    variables: { orderId },
    fetchPolicy: 'network-only',
    skip: !isFocused
  })

  const { data: subscriptionData, error: subscriptionError } =
    useSubscription<SubscriptionData>(ORDER_RIDER_LOCATION_UPDATED, {
      variables: { orderId },
      skip: !isFocused
    })

  const newestLocation = useMemo(() => {
    const incoming = subscriptionData?.orderRiderLocationUpdated
    const initial = data?.orderRiderLocation
    if (!incoming) return initial ?? null
    if (!initial) return incoming
    return Date.parse(incoming.receivedAt) >= Date.parse(initial.receivedAt)
      ? incoming
      : initial
  }, [data, subscriptionData])

  useEffect(() => {
    if (!isValidLocation(newestLocation)) return
    setLocation((current) => {
      if (
        current &&
        Date.parse(current.receivedAt) >= Date.parse(newestLocation!.receivedAt)
      ) return current
      return newestLocation
    })
  }, [newestLocation])

  // Drives both the position interpolation (dead-reckoned projection between
  // heartbeats, correcting onto each authoritative fix) and the heading
  // rotation. Kept as a single effect so all of its timers share one cleanup.
  useEffect(() => {
    if (!location) return

    const previous = previousFixRef.current
    previousFixRef.current = location

    const distanceFromPrevious = previous ? haversineDistanceMeters(previous, location) : 0
    // Ignore GPS jitter: only trust a movement-derived bearing once the
    // rider has actually moved a few meters between fixes.
    const bearingFromMovement =
      previous && distanceFromPrevious > 3 ? bearingBetween(previous, location) : null
    const reportedHeading = Number.isFinite(location.headingDegrees ?? NaN)
      ? (location.headingDegrees as number)
      : null
    const resolvedHeading = reportedHeading !== null ? reportedHeading : bearingFromMovement

    let rotatingTimer: ReturnType<typeof setTimeout> | undefined

    if (!hasPosition.current) {
      latitude.value = location.latitude
      longitude.value = location.longitude
      if (resolvedHeading !== null) heading.value = resolvedHeading
      hasPosition.current = true
    } else {
      const elapsedSeconds = previous
        ? Math.max(1, (Date.parse(location.receivedAt) - Date.parse(previous.receivedAt)) / 1000)
        : CUSTOMER_TRACKING_CONFIG.heartbeatIntervalMs / 1000
      const derivedSpeed =
        previous && distanceFromPrevious > 3 ? distanceFromPrevious / elapsedSeconds : 0
      const speed = Number.isFinite(location.speedMetersPerSecond ?? NaN) &&
        (location.speedMetersPerSecond as number) > 0
        ? (location.speedMetersPerSecond as number)
        : derivedSpeed

      const projectionDistance = Math.min(
        speed * CUSTOMER_TRACKING_CONFIG.projectionSeconds,
        CUSTOMER_TRACKING_CONFIG.maxProjectionMeters
      )

      if (resolvedHeading !== null && projectionDistance > 2) {
        // Ease toward a point a bit further along the rider's current
        // bearing than the fix we just received, then settle exactly onto
        // the real fix — reads as continuous forward motion rather than a
        // snap-then-pause on every heartbeat.
        const projected = destinationPoint(location, resolvedHeading, projectionDistance)
        const ratio = CUSTOMER_TRACKING_CONFIG.projectionOvershootRatio
        const overshootLat = location.latitude + (projected.latitude - location.latitude) * ratio
        const overshootLng = location.longitude + (projected.longitude - location.longitude) * ratio
        const phase1Ms = Math.round(CUSTOMER_TRACKING_CONFIG.heartbeatIntervalMs * 0.5)
        const phase2Ms = Math.max(
          CUSTOMER_TRACKING_CONFIG.heartbeatIntervalMs - phase1Ms - 2_000,
          4_000
        )

        latitude.value = withSequence(
          withTiming(overshootLat, { duration: phase1Ms }),
          withTiming(location.latitude, { duration: phase2Ms })
        )
        longitude.value = withSequence(
          withTiming(overshootLng, { duration: phase1Ms }),
          withTiming(location.longitude, { duration: phase2Ms })
        )
      } else {
        // No usable heading/speed (e.g. rider stationary) — just ease onto
        // the new fix.
        latitude.value = withTiming(location.latitude, { duration: 1_500 })
        longitude.value = withTiming(location.longitude, { duration: 1_500 })
      }

      if (resolvedHeading !== null) {
        heading.value = withTiming(shortestAngleTarget(heading.value, resolvedHeading), {
          duration: 1_200
        })
        setIsRotating(true)
        rotatingTimer = setTimeout(() => setIsRotating(false), 1_300)
      }
    }

    onLocationChangeRef.current?.({
      latitude: location.latitude,
      longitude: location.longitude,
      headingDegrees: resolvedHeading,
      receivedAt: location.receivedAt
    })

    setFreshness('live')
    const updatingTimer = setTimeout(
      () => setFreshness('updating'),
      CUSTOMER_TRACKING_CONFIG.updatingAfterMs
    )
    const unavailableTimer = setTimeout(
      () => setFreshness('unavailable'),
      CUSTOMER_TRACKING_CONFIG.staleAfterMs
    )
    return () => {
      clearTimeout(updatingTimer)
      clearTimeout(unavailableTimer)
      if (rotatingTimer) clearTimeout(rotatingTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location])

  const animatedProps = useAnimatedProps(() => ({
    coordinate: {
      latitude: latitude.value,
      longitude: longitude.value
    }
  }))

  // Rotates the marker icon to face the direction of travel. Applied to a
  // wrapper View (not the Marker itself) since custom marker children on
  // react-native-maps ignore the native `rotation` prop — that only rotates
  // the default pin.
  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotateZ: `${heading.value}deg` }]
  }))

  // Derive the user-facing status label. This is reported to the parent (via
  // onStatusChange) instead of rendered here, so the overlay can live outside
  // the MapView — see the Props.onStatusChange note.
  const statusLabel = useMemo<string | null>(() => {
    if (error || subscriptionError) return 'Rider location unavailable'
    if (!location) return loading ? null : 'Updating rider location…'
    if (freshness === 'updating') return 'Updating rider location…'
    if (freshness === 'unavailable') return 'Rider location unavailable'
    return null
  }, [error, subscriptionError, location, loading, freshness])

  useEffect(() => {
    onStatusChange?.(statusLabel)
  }, [statusLabel, onStatusChange])

  // Clear the parent overlay when this component unmounts.
  useEffect(() => () => onStatusChange?.(null), [onStatusChange])

  // Only ever return a valid map feature (the marker) or null. Never a plain
  // View — it would be mounted as a native map feature and crash on Fabric.
  if (!location) return null

  return (
    <AnimatedMarker
      animatedProps={animatedProps}
      coordinate={{
        latitude: location.latitude,
        longitude: location.longitude
      }}
      opacity={freshness === 'unavailable' ? 0.5 : 1}
      title={freshness === 'live' ? 'Rider' : 'Rider location is updating'}
      // Custom-icon markers on native react-native-maps are baked into a
      // bitmap; tracksViewChanges must be true while the wrapped icon's
      // style is actively changing (rotation) so the bitmap stays in sync,
      // and false the rest of the time to avoid a costly re-snapshot on
      // every render. Position updates go through animatedProps.coordinate,
      // which doesn't need this.
      tracksViewChanges={isRotating}
    >
      <Animated.View style={iconAnimatedStyle}>
        <RiderMarker />
      </Animated.View>
    </AnimatedMarker>
  )
}

export default TrackingRider
