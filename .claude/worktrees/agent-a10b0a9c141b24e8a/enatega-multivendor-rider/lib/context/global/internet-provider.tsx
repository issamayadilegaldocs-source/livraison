import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus, View, Text } from "react-native";
import * as Network from 'expo-network'

import { NoInternetIcon } from "@/lib/ui/useable-components/svg";

interface InternetContextProps {
  isConnected: boolean;
}

const InternetContext = createContext<InternetContextProps | undefined>(
  undefined,
);

export const useInternet = (): InternetContextProps => {
  const context = useContext(InternetContext);
  if (!context) {
    throw new Error("useInternet must be used within an InternetProvider");
  }
  return context;
};

const InternetProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isConnected, setIsConnected] = useState<boolean|undefined>(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const checkConnection = async () => {
      const networkState = await Network.getNetworkStateAsync()
      setIsConnected(networkState.isConnected)
    }

    checkConnection()

    // Check on app foreground transitions instead of constant polling
    const appStateHandler = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        checkConnection()
      }
    }
    const subscription = AppState.addEventListener('change', appStateHandler)

    // Poll every 30s instead of 5s — enough to detect prolonged outages
    intervalRef.current = setInterval(checkConnection, 30000)

    return () => {
      subscription.remove()
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  // Previously this returned a full-screen replacement instead of `children`
  // when offline, unmounting the entire app (map, active order, everything)
  // on every network blip — a rider mid-delivery in a dead zone lost the
  // ability to see the order or tap deliver/pickup entirely. Always render
  // the app; a non-blocking banner is enough to inform the rider without
  // taking away their ability to keep working from cached state.
  return (
    <InternetContext.Provider value={{ isConnected: isConnected ?? true }}>
      {children}
      {!isConnected && (
        <View
          pointerEvents="none"
          className="absolute top-0 left-0 right-0 items-center justify-center bg-amber-500 py-2"
          style={{ paddingTop: 40 }}
        >
          <View className="flex-row items-center gap-2">
            <NoInternetIcon width={18} height={18} />
            <Text className="font-[Inter] text-black text-sm font-bold">
              No Internet Connection
            </Text>
          </View>
        </View>
      )}
    </InternetContext.Provider>
  );
};

export default InternetProvider;
