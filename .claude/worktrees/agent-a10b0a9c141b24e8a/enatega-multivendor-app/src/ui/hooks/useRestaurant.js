import { useQuery } from '@apollo/client'
import gql from 'graphql-tag'
import { restaurant } from '../../apollo/queries'

// Exported so prefetch helpers can warm the cache with the *exact* same document
// (re-defining it elsewhere would create a second, drift-prone cache entry).
export const RESTAURANT = gql`
  ${restaurant}
`

// Default to cache-first: the restaurant detail is fetched on the Restaurant
// screen and then read again by Cart and Checkout for the *same* restaurant.
// With the previous 'network-only' policy each of those screens blocked behind
// a fresh full network round-trip for data already in the cache. cache-first
// lets Cart/Checkout paint instantly; the Restaurant screen opts into
// 'cache-and-network' so stock/availability stays fresh while still painting
// cached data immediately on revisit.
export default function useRestaurant(id, fetchPolicy = 'cache-first') {
  const { data, refetch, networkStatus, loading, error } = useQuery(
    RESTAURANT,
    { variables: { id }, fetchPolicy }
  )
  return { data, refetch, networkStatus, loading, error }
}
