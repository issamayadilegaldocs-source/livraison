import { useApptheme } from "@/lib/context/global/theme.context";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import WalletMain from "../../screen-components/wallet/view/main";
import React from "react";

export default function WalletScreen() {
  const { appTheme } = useApptheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: appTheme.screenBackground }}>
      <View className="w-full items-center flex-1">
        <WalletMain />
      </View>
    </SafeAreaView>
  );
}
