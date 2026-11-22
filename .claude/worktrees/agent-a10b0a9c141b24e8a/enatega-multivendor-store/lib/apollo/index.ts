import {
  ApolloClient,
  ApolloLink,
  concat,
  createHttpLink,
  InMemoryCache,
  Observable,
  Operation,
  split,
} from "@apollo/client";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { getMainDefinition } from "@apollo/client/utilities";
import { createClient } from "graphql-ws";

import getEnvVars from "@/environment";
import { DefinitionNode, FragmentDefinitionNode } from "graphql";
import { Subscription } from "zen-observable-ts";
import PublicAccessTokenService from "../services/public-access-token.service";

const setupApollo = (getToken: () => Promise<string | null>) => {
  const { GRAPHQL_URL, WS_GRAPHQL_URL } = getEnvVars();

  const wsLink = new GraphQLWsLink(
    createClient({
      url: WS_GRAPHQL_URL,
      lazy: true,
      keepAlive: 15_000,
      retryAttempts: Infinity,
      shouldRetry: () => true,
      retryWait: (attempt) =>
        new Promise((resolve) =>
          setTimeout(resolve, Math.min(1_000 * 2 ** attempt, 30_000)),
        ),
      connectionParams: async () => {
        const token = await getToken();
        return {
          authorization: token ? `Bearer ${token}` : "",
        };
      },
    }),
  );
  const cache = new InMemoryCache();
  const httpLink = createHttpLink({
    uri: GRAPHQL_URL,
  });

  const client = new ApolloClient({
    link: httpLink,
    cache,
  });

  const request = async (operation: Operation) => {
    const skipPublicAuth =
      operation.getContext().headers?.["x-skip-public-auth"];
    const token = await getToken();
    const nonce = PublicAccessTokenService.getNonce();

    const headers: Record<string, string> = {
      authorization: token ? `Bearer ${token}` : "",
      nonce: nonce || "",
      "x-platform": "mobile",
      ...operation.getContext().headers,
    };

    if (!skipPublicAuth) {
      const publicToken = await PublicAccessTokenService.getToken(client);
      headers["bop-auth"] = publicToken ? `Bearer ${publicToken}` : "";
    }

    operation.setContext({ headers });
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

  const terminatingLink = split(({ query }) => {
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
  }, wsLink);

  client.setLink(
    concat(ApolloLink.from([terminatingLink, requestLink]), httpLink),
  );

  return client;
};

export default setupApollo;
