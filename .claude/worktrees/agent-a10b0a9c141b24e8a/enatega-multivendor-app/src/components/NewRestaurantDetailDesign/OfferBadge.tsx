import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useQuery } from '@apollo/client'
import { ACTIVE_RESTAURANT_OFFERS } from '../../apollo/queries'

interface ActiveOffer {
  _id: string
  title?: string | null
  type: string
  value: number
  active?: boolean
}

interface ActiveOffersData {
  activeRestaurantOffers: ActiveOffer[]
}

interface OfferBadgeProps {
  restaurantId?: string
}

function formatDiscount(offer: ActiveOffer): string {
  const amount =
    offer.type === 'PERCENTAGE' ? `${offer.value}%` : `${offer.value}`
  return `-${amount}`
}

/**
 * Shows the restaurant's currently-active time-boxed offer as a small pill.
 * The discount itself is applied server-side at checkout; this is pre-checkout
 * visibility only. Renders nothing when the shop has no active offer.
 */
const OfferBadge: React.FC<OfferBadgeProps> = ({ restaurantId }) => {
  const { data } = useQuery<ActiveOffersData>(ACTIVE_RESTAURANT_OFFERS, {
    variables: { restaurantId },
    skip: !restaurantId,
    fetchPolicy: 'cache-and-network'
  })

  const offers = data?.activeRestaurantOffers ?? []
  const offer = offers.find((o) => o.active) ?? offers[0]
  if (!offer) return null

  return (
    <View style={styles.badge} accessibilityRole="text">
      <Text style={styles.badgeText}>
        {formatDiscount(offer)}
        {offer.title ? ` · ${offer.title}` : ''}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#16a34a',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700'
  }
})

export default OfferBadge
