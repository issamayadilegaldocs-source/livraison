"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const AuthGuard = <T extends object>(Component: React.ComponentType<T>) => {
  const WrappedComponent = (props: T) => {
    const { isLoaded, isSignedIn } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!isLoaded) return;
      if (!isSignedIn) {
        router.replace("/");
      }
    }, [isLoaded, isSignedIn, router]);

    if (!isLoaded) return null;
    if (!isSignedIn) return null;

    return <Component {...props} />;
  };

  return WrappedComponent;
};

export default AuthGuard;
