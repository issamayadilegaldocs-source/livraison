import { ApolloClient, ApolloError } from "@apollo/client";

import { OWNER_PROFILE, STORE_PROFILE } from "@/lib/api/graphql/query/owner";
import * as SecureStore from "@/lib/utils/safeSecureStore";

// True only for the backend's "no store linked to this identity" response —
// i.e. a real GraphQL not-found, not a network/server failure. Used to decide
// whether falling back to the owner-level profile is safe.
export const isStoreProfileNotFound = (error: unknown): boolean => {
  if (!(error instanceof ApolloError)) return false;
  if (error.networkError) return false;
  return error.graphQLErrors.some((e) =>
    /store profile not found/i.test(e.message),
  );
};

/**
 * Resolves the caller's restaurant id from the ACTIVE session (per-restaurant
 * login first, owner-level fallback) and refreshes the cached "store-id".
 *
 * The cached value must never be trusted on its own: a database reseed swaps
 * every restaurant `_id` while the Clerk session (and the id it cached at
 * login) survives, and the API rejects order subscriptions whose restaurant
 * argument doesn't match the session's actual restaurant.
 *
 * Returns null when the session genuinely has no linked restaurant; rethrows
 * network/server failures so callers can distinguish "retry later" from
 * "unlinked account".
 */
export const resolveAndCacheStoreId = async (
  apolloClient: ApolloClient<object>,
): Promise<string | null> => {
  let restaurantId: string | undefined;

  try {
    const { data } = await apolloClient.query({
      query: STORE_PROFILE,
      fetchPolicy: "network-only",
    });
    restaurantId = data?.storeProfile?._id;
  } catch (error) {
    if (!isStoreProfileNotFound(error)) throw error;
  }

  if (!restaurantId) {
    const { data } = await apolloClient.query({
      query: OWNER_PROFILE,
      fetchPolicy: "network-only",
    });
    restaurantId = data?.ownerProfile?.restaurants?.[0]?._id;
  }

  if (!restaurantId) return null;

  await SecureStore.setItemAsync("store-id", restaurantId);
  return restaurantId;
};
