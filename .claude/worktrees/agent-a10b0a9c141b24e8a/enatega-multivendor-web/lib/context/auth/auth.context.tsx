"use client";

import {
  useAuth as useClerkAuth,
  useClerk,
} from "@clerk/nextjs";
import {
  createContext,
  Dispatch,
  ReactNode,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { IAuthContextProps } from "@/lib/utils/interfaces";

const AuthContext = createContext({} as IAuthContextProps);

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [activePanel, setActivePanel] = useState(0);
  const [isAuthModalVisible, setIsAuthModalVisible] = useState(false);

  const { isSignedIn, getToken } = useClerkAuth();
  const { signOut } = useClerk();

  // Stable sentinel for legacy callers that do `if (authToken)` truthiness checks.
  // Never send this value as a bearer token — call getToken() for a fresh JWT.
  const authToken = isSignedIn ? "authenticated" : "";

  // Close the modal when sign-in/sign-up completes.
  useEffect(() => {
    if (isSignedIn) {
      setIsAuthModalVisible(false);
      setActivePanel(0);
    }
  }, [isSignedIn]);

  // Kept for backwards compatibility: callers that pass "" trigger sign-out.
  const setAuthToken = useCallback(
    async (token: string) => {
      if (!token) {
        await signOut();
      }
    },
    [signOut],
  );

  return (
    <AuthContext.Provider
      value={{
        authToken,
        setAuthToken: setAuthToken as unknown as Dispatch<SetStateAction<string>>,
        getToken,
        isAuthModalVisible,
        setIsAuthModalVisible,
        activePanel,
        setActivePanel,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
