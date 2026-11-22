// Apollo
import {
  ApolloClient,
  ApolloLink,
  concat,
  createHttpLink,
  InMemoryCache,
  NormalizedCacheObject,
  Observable,
  Operation,
  split,
} from "@apollo/client";
import { onError } from "@apollo/client/link/error";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { getMainDefinition } from "@apollo/client/utilities";

// GQL
import { createClient } from "graphql-ws";

// Utility imports
import { Subscription } from "zen-observable-ts";
import { useMemo, useRef } from "react";

import {
  initializeNonce,
  getNonce,
  storeMetricsToken,
  getMetricsToken,
  shouldRefreshToken,
} from '../utils/methods/security';
import { METRICS_GENERAL } from '../api/graphql/mutations/metrics';
import { print } from 'graphql';

// ─── Idempotency ──────────────────────────────────────────────────────────────

/**
 * Mutations that must carry an Idempotency-Key header to prevent duplicate
 * side-effects on accidental double-submit or a network retry after
 * reconnect. PlaceOrder in particular has no client-side offline guard on
 * this app, so a customer who submits, loses connectivity, and the request
 * retries must not get charged/order-placed twice.
 */
const IDEMPOTENT_MUTATIONS = new Set(["PlaceOrder"]);

/**
 * Tracks one key per in-flight idempotent mutation. The key is generated the
 * first time an operation starts and cleared when it completes (success or
 * error), so retries within the same user action reuse the same key while a
 * fresh submit gets a new one.
 */
const idempotencyKeys = new Map<string, string>();

function getIdempotencyKey(operationName: string): string {
  let key = idempotencyKeys.get(operationName);
  if (!key) {
    key = crypto.randomUUID();
    idempotencyKeys.set(operationName, key);
  }
  return key;
}

function clearIdempotencyKey(operationName: string): void {
  idempotencyKeys.delete(operationName);
}

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function fetchMetricsToken(serverUrl?: string): Promise<string | null> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const nonce = getNonce();
      const response = await fetch(`${serverUrl}graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          nonce: nonce || '',
        },
        body: JSON.stringify({
          query: print(METRICS_GENERAL),
        }),
      });

      const result = await response.json();
      if (result.data?.metricsGeneral) {
        const { experience, hehe } = result.data.metricsGeneral;
        storeMetricsToken(experience, hehe);
        return experience;
      }
      return null;
    } catch (error) {
      console.error('Failed to fetch metrics token:', error);
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Sets up an Apollo Client that uses the Clerk session JWT for authentication.
 * Pass `getToken` from Clerk's `useAuth()` hook so every request gets a fresh
 * short-lived token without stale localStorage reads.
 */
export const useSetupApollo = (
  getToken: () => Promise<string | null>,
): ApolloClient<NormalizedCacheObject> => {
  const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL;
  const WS_SERVER_URL = process.env.NEXT_PUBLIC_WS_SERVER_URL;

  // Clerk's getToken identity can change between renders; keep the latest in a
  // ref so the memoized client below is never invalidated by auth re-renders.
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  // The client must be created exactly once: re-creating it on every render
  // resets the cache, restarts every active query (the whole app flashes back
  // to loading) and leaks WebSocket connections.
  const client = useMemo(() => {
    initializeNonce();

    const cache = new InMemoryCache();

    const httpLink = createHttpLink({
      uri: `${SERVER_URL}graphql`,
    });

    // WebSocket link — passes the Clerk JWT in connection params so subscriptions
    // are also authenticated by the backend's ClerkAuthGuard.
    const wsLink = new GraphQLWsLink(
      createClient({
        url: `${WS_SERVER_URL}graphql`,
        lazy: true,
        keepAlive: 15_000,
        retryAttempts: Infinity,
        shouldRetry: () => true,
        retryWait: (attempt) =>
          new Promise((resolve) =>
            setTimeout(resolve, Math.min(1_000 * 2 ** attempt, 30_000)),
          ),
        connectionParams: async () => {
          const token = await getTokenRef.current();
          return {
            authorization: token ? `Bearer ${token}` : '',
          };
        },
      })
    );

    const errorLink = onError(({ networkError, graphQLErrors, operation }) => {
      if (networkError) {
        console.error("Network Error:", networkError);
      }

      if (graphQLErrors) {
        (graphQLErrors || [])?.forEach((error) => {
          console.error("GraphQL Error:", error?.message);
          if (error.extensions?.code === "UNAUTHENTICATED") {
            if (typeof window !== "undefined") {
              localStorage.clear();
              sessionStorage.clear();
              if (window.location.pathname !== "/") {
                window.location.href = "/";
              }
            }
          }
        });
      }

      // Clear the idempotency key on error so the next retry gets a fresh
      // key rather than reusing a possibly-partially-processed one forever.
      if (IDEMPOTENT_MUTATIONS.has(operation.operationName)) {
        clearIdempotencyKey(operation.operationName);
      }
    });

    const request = async (operation: Operation): Promise<void> => {
      const token = await getTokenRef.current();
      const operationName = operation.operationName;

      if (operationName !== 'MetricsGeneral' && shouldRefreshToken()) {
        await fetchMetricsToken(SERVER_URL);
      }

      const nonce = getNonce();
      const metricsToken = getMetricsToken();

      const extraHeaders: Record<string, string> = {};
      if (IDEMPOTENT_MUTATIONS.has(operationName)) {
        extraHeaders["Idempotency-Key"] = getIdempotencyKey(operationName);
      }

      operation.setContext({
        headers: {
          authorization: token ? `Bearer ${token}` : '',
          nonce: nonce || '',
          'bop-auth': metricsToken ? `Bearer ${metricsToken}` : '',
          "X-Client-Type": "web",
          ...extraHeaders,
        },
      });
    };

    const requestLink = new ApolloLink(
      (operation, forward) =>
        new Observable((observer) => {
          let handle: Subscription | undefined;
          Promise.resolve(operation)
            .then((oper) => request(oper))
            .then(() => {
              handle = forward(operation).subscribe({
                next: (result) => {
                  // Clear the idempotency key after a successful response so
                  // the customer's *next* order gets a fresh key.
                  if (IDEMPOTENT_MUTATIONS.has(operation.operationName)) {
                    clearIdempotencyKey(operation.operationName);
                  }
                  observer.next(result);
                },
                error: observer.error.bind(observer),
                complete: observer.complete.bind(observer),
              });
            })
            .catch(observer.error.bind(observer));

          return () => {
            if (handle) handle.unsubscribe();
          };
        })
    );

    const terminatingLink = split(({ query }) => {
      const definition = getMainDefinition(query);
      return (
        definition.kind === "OperationDefinition" &&
        definition.operation === "subscription"
      );
    }, wsLink);

    return new ApolloClient({
      link: concat(
        ApolloLink.from([errorLink, terminatingLink, requestLink]),
        httpLink
      ),
      cache,
      connectToDevTools: true,
    });
  }, [SERVER_URL, WS_SERVER_URL]);

  return client;
};
