import { useAuth } from "@clerk/clerk-expo";
import { useMutation } from "@apollo/client";
import { Href, router } from "expo-router";
import React from "react";

import { IAuthContext, IAuthProviderProps } from "@/lib/utils/interfaces";
import { ROUTES } from "@/lib/utils/constants";
import {
  clearPresenceSession,
  stopTracking,
} from "@/lib/services/rider-tracking.service";
import { UNREGISTER_PUSH_TOKEN } from "@/lib/apollo/mutations/push-token.mutation";
import { getNotificationToken } from "@/lib/utils/methods/permission";

export const AuthContext = React.createContext<IAuthContext>(
  {} as IAuthContext
);

export const AuthProvider: React.FC<IAuthProviderProps> = ({ children }) => {
  const { isSignedIn, getToken, signOut } = useAuth();
  const [unregisterPushToken] = useMutation(UNREGISTER_PUSH_TOKEN);

  const logout = async () => {
    try {
      // Must run before signOut() invalidates the session the mutation
      // needs to authenticate. Previously nothing cleared this device's
      // token on logout — the next rider logging in on the same
      // (shared/fleet) device could otherwise receive dispatch pings
      // meant for this rider until the backend's per-token reassignment
      // guard caught it on their own registration. Best-effort: never
      // block logout on this.
      const token = await getNotificationToken().catch(() => null);
      if (token) {
        await unregisterPushToken({ variables: { token } }).catch(() => {});
      }

      await stopTracking().catch(() => {});
      await clearPresenceSession().catch(() => {});

      await signOut();
    } catch (e) {
      console.log("Logout Error: ", e);
    } finally {
      // The startup redirect in app/index.tsx is unmounted once the rider is
      // inside (tabs), so it can't react to isSignedIn flipping to false.
      // Send the rider back to login explicitly.
      router.replace(ROUTES.login as Href);
    }
  };

  const values: IAuthContext = {
    isSignedIn,
    getToken,
    logout,
  };

  return <AuthContext.Provider value={values}>{children}</AuthContext.Provider>;
};
