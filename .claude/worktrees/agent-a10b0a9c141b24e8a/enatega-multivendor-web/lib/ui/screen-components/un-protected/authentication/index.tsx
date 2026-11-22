"use client";

import { useClerk, useAuth as useClerkAuth } from "@clerk/nextjs";
import { useAuth } from "@/lib/context/auth/auth.context";
import { IAuthModalProps } from "@/lib/utils/interfaces";
import { useCallback, useEffect } from "react";

export default function AuthModal({ isAuthModalVisible }: IAuthModalProps) {
  const { activePanel, setActivePanel, setIsAuthModalVisible } = useAuth();
  const { openSignIn, openSignUp } = useClerk();
  const { isSignedIn } = useClerkAuth();

  const handleClerkModalClose = useCallback(() => {
    setIsAuthModalVisible(false);
    setActivePanel(0);
  }, [setActivePanel, setIsAuthModalVisible]);

  useEffect(() => {
    if (!isAuthModalVisible) return;
    if (isSignedIn) {
      setIsAuthModalVisible(false);
      return;
    }

    const sharedModalProps = {
      fallbackRedirectUrl: "/",
      onClose: handleClerkModalClose,
    };

    if (activePanel === 1) {
      openSignUp({
        ...sharedModalProps,
        signInFallbackRedirectUrl: "/",
      } as Parameters<typeof openSignUp>[0]);
    } else {
      openSignIn({
        ...sharedModalProps,
        signUpFallbackRedirectUrl: "/",
      } as Parameters<typeof openSignIn>[0]);
    }

    setIsAuthModalVisible(false);
  }, [
    activePanel,
    handleClerkModalClose,
    isAuthModalVisible,
    isSignedIn,
    openSignIn,
    openSignUp,
    setIsAuthModalVisible,
  ]);

  return null;
}
