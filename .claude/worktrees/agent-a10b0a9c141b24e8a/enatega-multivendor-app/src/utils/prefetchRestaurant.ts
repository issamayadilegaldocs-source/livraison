import type { ApolloClient } from '@apollo/client'
import { Image } from 'expo-image'
import { RESTAURANT } from '../ui/hooks/useRestaurant'

// Restaurant ids whose detail query is already being prefetched. Prevents a card
// that is hovered, scrolled into view, and tapped from firing three identical
// network requests.
const inFlight = new Set<string>()

/**
 * Warm the Apollo cache for a restaurant's full detail query before the user
 * navigates, so the Restaurant screen's cache-and-network read paints instantly.
 *
 * Uses `cache-first`, so it is a no-op when the data is already cached, and runs
 * on the same authenticated client — no new endpoint or auth surface.
 */
export function prefetchRestaurant(
  client: ApolloClient<object>,
  id?: string | null,
  heroImage?: string | null
): void {
  if (!id || inFlight.has(id)) return
  inFlight.add(id)

  client
    .query({ query: RESTAURANT, variables: { id }, fetchPolicy: 'cache-first' })
    .catch(() => {
      // Prefetch is best-effort; a failure here just means the screen fetches
      // normally on mount. Never surface this to the user.
    })
    .finally(() => {
      inFlight.delete(id)
    })

  // Warm the destination hero image too, so it is decoded by the time the
  // navigation transition settles.
  if (heroImage) {
    Image.prefetch(heroImage).catch(() => {})
  }
}
