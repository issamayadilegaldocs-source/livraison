import {
  ApolloClient,
  InMemoryCache,
  createHttpLink,
  ApolloLink,
  split,
  concat,
  Observable
} from '@apollo/client'
import {
  getMainDefinition,
  offsetLimitPagination
} from '@apollo/client/utilities'
import { GraphQLWsLink } from '@apollo/client/link/subscriptions'
import { createClient } from 'graphql-ws'
import { useAuth } from '@clerk/clerk-expo'
import { useEffect, useMemo, useRef } from 'react'
import useEnvVars from '../../environment'
import { calculateDistance } from '../utils/customFunctions'
import { getValidPublicToken } from '../services/publicAcccessService'
import { getOrCreateNonce } from '../utils/publicAccessToken'
import { Platform } from 'react-native'
import { v4 as uuidv4 } from 'uuid'

// ─── Idempotency ──────────────────────────────────────────────────────────────
// Mutations that must carry an Idempotency-Key header so a retried request
// (Apollo's graphql-ws retryAttempts:Infinity, or a customer double-tapping
// Place Order after a slow/failed response) doesn't place — and charge — the
// same order twice. Mirrors the same mechanism in the admin/web Apollo setup.
const IDEMPOTENT_MUTATIONS = new Set(['PlaceOrder'])
const idempotencyKeys = new Map()

function getIdempotencyKey(operationName) {
  let key = idempotencyKeys.get(operationName)
  if (!key) {
    key = uuidv4()
    idempotencyKeys.set(operationName, key)
  }
  return key
}

function clearIdempotencyKey(operationName) {
  idempotencyKeys.delete(operationName)
}

const setupApollo = () => {
  const { GRAPHQL_URL, WS_GRAPHQL_URL } = useEnvVars()
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const getTokenRef = useRef(getToken)
  getTokenRef.current = getToken
  // Holds the graphql-ws client so we can force a reconnect when the Clerk
  // session becomes available (see effect below).
  const wsClientRef = useRef(null)

  const client = useMemo(() => {
    const cache = new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            _id: {
              keyArgs: ['string']
            },
            orders: offsetLimitPagination(),
            getUsersActiveOrders: {
              merge(_existing, incoming) {
                return incoming
              }
            }
          }
        },
        Category: {
          fields: {
            foods: {
              merge(_existing, incoming) {
                return incoming
              }
            }
          }
        },
        Food: {
          fields: {
            variations: {
              merge(_existing, incoming) {
                return incoming
              }
            }
          }
        },
        RestaurantPreview: {
          fields: {
            distanceWithCurrentLocation: {
              read(_existing, { variables, readField }) {
                const restaurantLocation = readField('location')
                const distance = calculateDistance(
                  restaurantLocation?.coordinates[0],
                  restaurantLocation?.coordinates[1],
                  variables.latitude,
                  variables.longitude
                )
                return distance
              }
            },
            // Derive these from the restaurant id so a given restaurant always
            // reads the same value. Math.random() in a cache read returns a
            // different result on every read, churning the cache and forcing
            // re-renders of every list row on each render pass.
            freeDelivery: {
              read(_existing, { readField }) {
                const id = String(readField('_id') || '')
                return (id.charCodeAt(id.length - 1) || 0) % 2 === 0
              }
            },
            acceptVouchers: {
              read(_existing, { readField }) {
                const id = String(readField('_id') || '')
                return (id.charCodeAt(id.length - 1) || 0) % 2 === 1
              }
            }
          }
        }
      }
    })

    const httpLink = createHttpLink({
      uri: GRAPHQL_URL
    })

    const wsClient = createClient({
      url: WS_GRAPHQL_URL,
      // Connect lazily on the first subscription and keep the socket alive
      // while subscriptions are active; retry indefinitely so a flaky mobile
      // connection recovers on its own.
      lazy: true,
      retryAttempts: Infinity,
      shouldRetry: () => true,
      keepAlive: 10000,
      // Re-evaluated on every (re)connect, so each socket — including
      // reconnects after a token refresh — carries a fresh Clerk JWT.
      connectionParams: async() => {
        const token = await getTokenRef.current()
        return {
          Authorization: token ? `Bearer ${token}` : '',
          authorization: token ? `Bearer ${token}` : ''
        }
      }
    })
    wsClientRef.current = wsClient

    const wsLink = new GraphQLWsLink(wsClient)

    const request = async operation => {
      // Resolve the three credentials concurrently instead of serially — they
      // are independent, and serializing them added the sum of three async
      // round-trips (Clerk token + token/nonce lookups) to every request.
      const [token, publicToken, nonce] = await Promise.all([
        getTokenRef.current(),
        getValidPublicToken(GRAPHQL_URL),
        getOrCreateNonce()
      ])

      const extraHeaders = {}
      if (IDEMPOTENT_MUTATIONS.has(operation.operationName)) {
        extraHeaders['Idempotency-Key'] = getIdempotencyKey(operation.operationName)
      }

      operation.setContext({
        headers: {
          authorization: token ? `Bearer ${token}` : '',
          'bop-auth': publicToken ? `Bearer ${publicToken}` : '',
          nonce,
          'user-agent': `EnategaApp/${Platform.OS}`,
          'accept-language': 'en-US',
          'x-platform': Platform.OS,
          ...extraHeaders
        }
      })
    }

    const requestLink = new ApolloLink(
      (operation, forward) =>
        new Observable(observer => {
          let handle
          Promise.resolve(operation)
            .then(oper => request(oper))
            .then(() => {
              handle = forward(operation).subscribe({
                next: result => {
                  // A fresh submit should get a new key; only a retry of the
                  // exact same in-flight attempt should reuse it.
                  if (IDEMPOTENT_MUTATIONS.has(operation.operationName)) {
                    clearIdempotencyKey(operation.operationName)
                  }
                  observer.next(result)
                },
                error: err => {
                  if (IDEMPOTENT_MUTATIONS.has(operation.operationName)) {
                    clearIdempotencyKey(operation.operationName)
                  }
                  observer.error(err)
                },
                complete: observer.complete.bind(observer)
              })
            })
            .catch(observer.error.bind(observer))

          return () => {
            if (handle) handle.unsubscribe()
          }
        })
    )

    const terminatingLink = split(
      ({ query }) => {
        const { kind, operation } = getMainDefinition(query)
        return kind === 'OperationDefinition' && operation === 'subscription'
      },
      wsLink,
      concat(requestLink, httpLink)
    )

    return new ApolloClient({
      link: terminatingLink,
      cache,
      resolvers: {}
    })
  }, [GRAPHQL_URL, WS_GRAPHQL_URL])

  // graphql-ws sends connectionParams at socket-connect time. On a cold start a
  // socket can connect before Clerk has hydrated its session, sending an empty
  // Authorization. Once Clerk reports the session is loaded (or auth state
  // flips), terminate any such socket so the client reconnects and re-invokes
  // connectionParams with the now-available JWT. retryAttempts: Infinity above
  // ensures the terminated socket is re-established.
  useEffect(() => {
    if (!isLoaded || !wsClientRef.current) return
    try {
      // terminate() abruptly closes the active socket; graphql-ws then retries
      // the connection, re-reading the fresh token. No-op when no socket is up.
      wsClientRef.current.terminate()
    } catch (e) {
      // no active socket yet — nothing to reconnect
    }
  }, [isLoaded, isSignedIn])

  return client
}

export default setupApollo
