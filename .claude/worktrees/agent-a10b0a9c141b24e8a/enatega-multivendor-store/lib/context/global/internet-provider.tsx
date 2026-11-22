import React, { createContext, useContext, useEffect, useState } from "react";
import { View, Text } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { NoInternetIcon } from "@/lib/ui/useable-components/svg";

interface InternetContextProps {
  isConnected: boolean;
}

const InternetContext = createContext<InternetContextProps | undefined>(
  undefined,
);

export const useInternet = (): InternetContextProps => {
  // Hooks

  const context = useContext(InternetContext);
  if (!context) {
    throw new Error("useInternet must be used within an InternetProvider");
  }
  return context;
};

const InternetProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isConnected, setIsConnected] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected ?? false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Previously this returned a full-screen replacement instead of `children`
  // when offline, unmounting the entire app (order queue, menu, everything)
  // on every network blip — contradicts this app's own CLAUDE.md ("Show a
  // non-blocking amber banner when offline... never a modal that blocks
  // store operations"). Always render the app; the banner informs without
  // taking away the restaurant's ability to keep working from cached state.
  return (
    <InternetContext.Provider value={{ isConnected }}>
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
