import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client'
import { METRICS_GENERAL } from '../apollo/publicAccess'
import { savePublicToken, getOrCreateNonce, isTokenExpired, getPublicToken, getTokenExpiry } from '../utils/publicAccessToken'
import { Platform } from 'react-native'

let tokenRefreshPromise = null

// In-memory mirror of the persisted public token so the Apollo request link can
// resolve a valid token synchronously-fast on the hot path, without two
// AsyncStorage reads (expiry + token) on every single GraphQL request.
let memToken = null
let memExpiryMs = 0

export const fetchPublicAccessToken = async (graphqlUrl) => {
  if (tokenRefreshPromise) {
    return tokenRefreshPromise
  }

  tokenRefreshPromise = (async () => {
    try {
      const nonce = await getOrCreateNonce()

      const client = new ApolloClient({
        link: createHttpLink({
          uri: graphqlUrl,
          headers: {
            'user-agent': `EnategaApp/${Platform.OS}`,
            'accept-language': 'en-US',
            'x-platform': Platform.OS,
            nonce: nonce
          }
        }),
        cache: new InMemoryCache()
      })

      const { data } = await client.mutate({
        mutation: METRICS_GENERAL
      })

      const token = data.metricsGeneral.experience
      const expiry = data.metricsGeneral.hehe

      memToken = token
      memExpiryMs = new Date(expiry).getTime() || 0
      await savePublicToken(token, expiry)

      return token
    } catch (error) {
      console.error('Failed to fetch public access token:', error.message)
      throw error
    } finally {
      tokenRefreshPromise = null
    }
  })()

  return tokenRefreshPromise
}

export const getValidPublicToken = async (graphqlUrl) => {
  // Fast path: a still-valid token cached in memory — no AsyncStorage, no await chain.
  if (memToken && memExpiryMs > Date.now()) {
    return memToken
  }

  const expired = await isTokenExpired()

  if (expired) {
    return await fetchPublicAccessToken(graphqlUrl)
  }

  // Persisted token is valid but not yet mirrored in memory (e.g. cold start).
  // Hydrate the in-memory cache so subsequent requests skip AsyncStorage.
  const token = await getPublicToken()
  const expiry = await getTokenExpiry()
  memToken = token
  memExpiryMs = new Date(expiry).getTime() || 0
  return token
}
