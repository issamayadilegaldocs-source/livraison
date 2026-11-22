import { useApolloClient } from "@apollo/client";
import { useAuth } from "@clerk/clerk-expo";
import * as Device from "expo-device";
import { Href, router } from "expo-router";

import { resolveAndCacheStoreId } from "@/lib/utils/methods/resolve-store-id";
import { ROUTES } from "@/lib/utils/constants";

const requestNotificationPermissions = async () => {
  try {
    // Dynamic import so Expo Go doesn't crash at module load time
    const Notifications = await import("expo-notifications");
    const settings = await Notifications.getPermissionsAsync();
    let permissions = { ...settings };

    if (
      settings?.status !== "granted" ||
      (settings.ios &&
        settings.ios?.status !==
          Notifications.IosAuthorizationStatus.PROVISIONAL)
    ) {
      permissions = await Notifications.requestPermissionsAsync({
        ios: {
          allowProvisional: true,
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
    }

    const granted =
      permissions?.status === "granted" ||
      permissions.ios?.status ===
        Notifications.IosAuthorizationStatus.PROVISIONAL;

    if (!granted || !Device.isDevice) return;
  } catch {
    // Permission failures must never block the auth flow
  }
};

/**
 * Vendor-specific post-authentication step. Once a Clerk session is active
 * (after login, email verification, or password reset), this fetches the
 * owner's linked restaurant, caches the store id, requests notification
 * permissions, and routes into the app. Throws if no restaurant is linked.
 */
// `finalizeSession` is called both from the login screen (right after
// signIn.create) and from app/index.tsx's checkAuth (on cold start / Android
// OAuth activity restarts) whenever `isSignedIn` flips true. Both call sites
// can fire within the same tick, and since each concurrent call issues its
// own network-only STORE_PROFILE/OWNER_PROFILE queries, a failure in either
// duplicate call ends up signing out the session the other one just
// established. Sharing one in-flight promise makes concurrent callers await
// the same result instead of racing.
let inFlightFinalize: Promise<void> | null = null;

export const useStoreSession = () => {
  const apolloClient = useApolloClient();
  const { getToken } = useAuth();

  // `setActive` resolves before Clerk exposes the new session token, so a
  // query fired immediately after login can go out with no Authorization
  // header and get rejected by ClerkAuthGuard ("Missing bearer token"),
  // which the caller then treats as a fatal link failure and signs out.
  // Block until the token is actually available (or a short deadline).
  const waitForSessionToken = async () => {
    for (let attempt = 0; attempt < 20; attempt++) {
      try {
        if (await getToken()) return;
      } catch {
        // Clerk still transitioning — retry below.
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 250));
    }
  };

  const finalizeSession = async () => {
    if (inFlightFinalize) return inFlightFinalize;
    inFlightFinalize = doFinalizeSession();
    try {
      await inFlightFinalize;
    } finally {
      inFlightFinalize = null;
    }
  };

  const doFinalizeSession = async () => {
    // ClerkAuthGuard on the backend validates the session we just activated.
    await waitForSessionToken();

    // Per-restaurant login first, owner-level fallback; also refreshes the
    // cached "store-id" (shared helper with the orders subscription retry).
    const restaurantId = await resolveAndCacheStoreId(apolloClient);

    if (!restaurantId) {
      throw new Error(
        "No restaurant is linked to this account. Please contact support.",
      );
    }

    await requestNotificationPermissions();

    router.replace(ROUTES.home as Href);
  };

  return { finalizeSession };
};
