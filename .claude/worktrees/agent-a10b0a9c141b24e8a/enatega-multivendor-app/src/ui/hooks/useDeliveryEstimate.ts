import { useQuery } from '@apollo/client'
import { DELIVERY_TIME_ESTIMATE } from '../../apollo/queries'

type DeliveryEstimateOptions = {
  restaurantId?: string
  latitude?: number
  longitude?: number
  isPickedUp: boolean
}

type DeliveryEstimateData = {
  deliveryTimeEstimate: {
    totalMinutes: number
    source: 'static' | 'dynamic'
  }
}

export default function useDeliveryEstimate({ restaurantId, latitude, longitude, isPickedUp }: DeliveryEstimateOptions) {
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude)
  const { data, loading, error } = useQuery<DeliveryEstimateData>(DELIVERY_TIME_ESTIMATE, {
    variables: { restaurantId, latitude, longitude, isPickedUp },
    skip: !restaurantId || !hasCoordinates,
  })

  return {
    totalMinutes: data?.deliveryTimeEstimate?.totalMinutes,
    source: data?.deliveryTimeEstimate?.source,
    loading,
    error,
  }
}
