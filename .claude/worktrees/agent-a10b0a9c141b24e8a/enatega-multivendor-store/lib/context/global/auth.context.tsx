import { loadDevMessages, loadErrorMessages } from "@apollo/client/dev";
import { useMutation, useApolloClient } from "@apollo/client";
import { useAuth, useClerk } from "@clerk/clerk-expo";
import { LINK_VENDOR_ACCOUNT } from "../../api/graphql/mutation/order";

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import React, { Dispatch, SetStateAction, useEffect, useState } from "react";

import { router } from "expo-router";
import * as Localization from "expo-localization";
import { changeLanguage } from "i18next";

import { IAuthContext, IAuthProviderProps } from "@/lib/utils/interfaces";
import { ROUTES } from "@/lib/utils/constants";

export const AuthContext = React.createContext<IAuthContext>(
  {} as IAuthContext,
);

export const AuthProvider: React.FC<IAuthProviderProps> = ({ children }) => {
  const [isSelected, setIsSelected] = useState<string>("");

  const { isSignedIn, getToken } = useAuth();
  const { signOut } = useClerk();
  const apolloClient = useApolloClient();
  const [linkVendorAccount] = useMutation(LINK_VENDOR_ACCOUNT);

  const logout = async () => {
    try {
      apolloClient.stop();
      await Promise.all([
        apolloClient.clearStore(),
        // expo-secure-store has no web implementation — never let it block sign-out.
        SecureStore.deleteItemAsync("store-id").catch(() => {}),
      ]);
      await signOut();
      router.replace(ROUTES.login as never);
    } catch (e) {
      console.error("Logout Error:", e);
    }
  };

  const handleSetCurrentLanguage = async () => {
    try {
      const lng = await AsyncStorage.getItem("lang");

      let systemLanguage = "en";
      const locales = Localization.getLocales();
      if (locales && locales.length > 0 && locales[0].languageCode) {
        systemLanguage = locales[0].languageCode;
      }

      const selectedLanguage = lng || systemLanguage;
      await changeLanguage(selectedLanguage);
      setIsSelected(selectedLanguage);
    } catch (error) {
      console.error("Language setting error:", error);
      try {
        await changeLanguage("en");
        setIsSelected("en");
      } catch {}
    }
  };

  useEffect(() => {
    handleSetCurrentLanguage();
  }, []);

  useEffect(() => {
    if (!isSignedIn) return;
    // One-time link for a vendor who just accepted a Clerk invitation; for an
    // already-linked account this is a cheap no-op (linkVendorAccount returns
    // the existing Owner immediately). `resetStore()` must NOT run here: it
    // wipes the Apollo cache and refetches every active query, which races
    // with (and can abort) the STORE_PROFILE/OWNER_PROFILE lookups that
    // useStoreSession's finalizeSession is concurrently awaiting right after
    // login — intermittently bouncing a perfectly valid login back to /login.
    // A freshly-linked account's next network-only query already gets fresh
    // data without needing a full store reset.
    linkVendorAccount().catch(() => {});
  }, [isSignedIn]);

  useEffect(() => {
    if (__DEV__) {
      loadDevMessages();
      loadErrorMessages();
    }
  }, []);

  const values: IAuthContext = {
    isSignedIn,
    getToken,
    logout,
    isSelected,
    setIsSelected,
  };

  return <AuthContext.Provider value={values}>{children}</AuthContext.Provider>;
};
