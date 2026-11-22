import { useAuth, useClerk } from "@clerk/clerk-expo";
import * as SecureStore from "@/lib/utils/safeSecureStore";
import { Href, useRouter } from "expo-router";
import { useCallback, useEffect } from "react";

import { ROUTES } from "@/lib/utils/constants";
import SpinnerComponent from "@/lib/ui/useable-components/spinner";
import { FlashMessageComponent } from "@/lib/ui/useable-components";
import { useStoreSession } from "@/lib/hooks/useStoreSession";

function App() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const { finalizeSession } = useStoreSession();

  const checkAuth = useCallback(async () => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      router.replace(ROUTES.login as Href);
      return;
    }

    const id = await SecureStore.getItemAsync("store-id");
    if (id) {
      router.replace(ROUTES.home as Href);
      return;
    }

    // Signed in but the restaurant ID isn't cached. This is the expected state
    // when the Android OAuth browser restarts the activity mid-login (the
    // finalizeSession step that caches store-id never got to run), and also
    // after an app reinstall with a surviving Clerk session. Re-derive the
    // store from the active session instead of forcing the user to log in
    // again — finalizeSession caches store-id and routes home on success.
    try {
      await finalizeSession();
    } catch (error: unknown) {
      // No restaurant linked / unrecoverable — fall back to a clean login.
      // Surface why, or this looks like an unexplained redirect loop.
      const message = error instanceof Error ? error.message : undefined;
      if (message) FlashMessageComponent({ message });
      await signOut();
      router.replace(ROUTES.login as Href);
    }
  }, [isLoaded, isSignedIn, signOut, finalizeSession, router]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return <SpinnerComponent />;
}

export default App;
