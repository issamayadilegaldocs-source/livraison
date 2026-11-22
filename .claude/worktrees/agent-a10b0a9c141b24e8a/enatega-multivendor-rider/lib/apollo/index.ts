import {
  ApolloClient,
  ApolloLink,
  createHttpLink,
  InMemoryCache,
  Observable,
  Operation,
  split,
} from "@apollo/client";
import { onError } from "@apollo/client/link/error";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import {
  getMainDefinition,
  offsetLimitPagination,
} from "@apollo/client/utilities";
import { useAuth } from "@clerk/clerk-expo";
import { useMemo, useRef } from "react";
import { getLocales } from "expo-localization";
import { Platform } from "react-native";
import { DefinitionNode, FragmentDefinitionNode } from "graphql";
import { Subscription } from "zen-observable-ts";
import { createClient } from "graphql-ws";
import useEnvVars from "../../environment";
import { IRestaurantLocation } from "../utils/interfaces";
import { calculateDistance } from "../utils/methods/custom-functions";

interface ClosableSocket {
  close(code?: number, reason?: string): void;
}

const isClosableSocket = (value: unknown): value is ClosableSocket =>
  typeof value === "object" &&
  value !== null &&
  "close" in value &&
  typeof (value as { close?: unknown }).close === "function";

const setupApollo = () => {
  const { GRAPHQL_URL, WS_GRAPHQL_URL } = useEnvVars();
  const { getToken } = useAuth();

  // Clerk's getToken identity can change between renders; keep the latest in a
  // ref so the memoized client below is never invalidated by auth re-renders.
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  // The client must be created exactly once: re-creating it on every render
  // resets the cache, restarts every active query and leaks WebSocket
  // connections.
  const client = useMemo(() => {
  const cache = new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          _id: {
            keyArgs: ["string"],
          },
          orders: offsetLimitPagination(),
        },
      },
      Category: {
        fields: {
          foods: {
            merge(_existing, incoming) {
              return incoming;
            },
          },
        },
      },
      Food: {
        fields: {
          variations: {
            merge(_existing, incoming) {
              return incoming;
            },
          },
        },
      },
      RestaurantPreview: {
        fields: {
          distanceWithCurrentLocation: {
            read(_existing: IRestaurantLocation, { variables, readField }) {
              const restaurantLocation: IRestaurantLocation | undefined =
                readField("location");
              if (
                !restaurantLocation?.coordinates[0] ||
                !restaurantLocation?.coordinates[1]
              )
                return;
              const distance = calculateDistance(
                restaurantLocation.coordinates[0][0][0],
                restaurantLocation.coordinates[0][0][1],
                variables?.latitude,
                variables?.longitude,
              );
              return distance;
            },
          },
          freeDelivery: {
            read() {
              return Math.random() * 10 > 5;
            },
          },
          acceptVouchers: {
            read() {
              return Math.random() * 10 < 5;
            },
          },
        },
      },
    },
  });

  const httpLink = createHttpLink({
    uri: GRAPHQL_URL,
  });

  let restartWebSocket: () => void = () => {};
  const wsLink = new GraphQLWsLink(
    createClient({
      url: WS_GRAPHQL_URL,
      lazy: true,
      shouldRetry: () => true,
      retryAttempts: Infinity,
      retryWait: (retries) =>
        new Promise((resolve) =>
          setTimeout(resolve, Math.min(1000 * 2 ** retries, 30000))
        ),
      connectionParams: async () => {
        const token = await getTokenRef.current();
        return {
          authorization: token ? `Bearer ${token}` : "",
        };
      },
      on: {
        opened: (socket) => {
          restartWebSocket = () => {
            if (isClosableSocket(socket)) socket.close(4205, "Client Restart");
          };
        },
        connected: () => console.log("✅ WebSocket connected"),
        closed: () => console.log("🔄 WebSocket closed"),
        error: () => {},
      },
    })
  );

  const request = async (operation: Operation) => {
    const token = await getTokenRef.current();
    const platform = Platform.OS;
    const locale = getLocales()[0]?.languageTag ?? "en";

    const currentHeaders = operation.getContext().headers ?? {};
    operation.setContext({
      headers: {
        ...currentHeaders,
        authorization: token ? `Bearer ${token}` : "",
        "x-platform": platform,
        "accept-language": locale,
        "user-agent": `Yalla-Rider-App/${platform}`,
        "ngrok-skip-browser-warning": "true",
      },
    });
  };

  const requestLink = new ApolloLink(
    (operation, forward) =>
      new Observable((observer) => {
        let handle: Subscription;
        Promise.resolve(operation)
          .then((oper) => request(oper))
          .then(() => {
            handle = forward(operation).subscribe({
              next: observer.next.bind(observer),
              error: observer.error.bind(observer),
              complete: observer.complete.bind(observer),
            });
          })
          .catch(observer.error.bind(observer));

        return () => {
          if (handle) handle.unsubscribe();
        };
      }),
  );

  const errorLink = onError(({ graphQLErrors, networkError, operation }) => {
    if (graphQLErrors) {
      graphQLErrors.forEach(({ message, locations, path }) => {
        if (message === 'Invalid or expired token') {
          // The cached WS token has expired on the server (e.g. after a server
          // restart). Close the socket so graphql-ws reconnects and calls
          // connectionParams() again to get a fresh Clerk token.
          const definition = getMainDefinition(operation.query);
          if (
            definition.kind === "OperationDefinition" &&
            definition.operation === "subscription"
          ) {
            restartWebSocket();
          }
          return;
        }
        console.log(
          `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`,
        );
      });
    }
    if (networkError) {
      console.log(`[Network error]: ${networkError}`);
    }
  });

  return new ApolloClient({
    link: ApolloLink.from([
      errorLink,
      requestLink,
      split(
        ({ query }) => {
          const definition = getMainDefinition(query) as
            | DefinitionNode
            | (FragmentDefinitionNode & {
                kind: string;
                operation?: string;
              });
          return (
            definition.kind === "OperationDefinition" &&
            definition.operation === "subscription"
          );
        },
        wsLink,
        httpLink
      ),
    ]),
    cache,
    resolvers: {},
  });
  }, [GRAPHQL_URL, WS_GRAPHQL_URL]);

  return client;
};

export default setupApollo;
