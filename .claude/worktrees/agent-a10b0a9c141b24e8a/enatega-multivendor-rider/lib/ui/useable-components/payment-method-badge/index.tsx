import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

interface PaymentMethodBadgeProps {
  paymentMethod?: string;
  size?: "sm" | "lg";
}

export default function PaymentMethodBadge({
  paymentMethod,
  size = "sm",
}: PaymentMethodBadgeProps) {
  const { t } = useTranslation();
  const isCOD = paymentMethod === "COD";

  return (
    <View
      style={{
        paddingHorizontal: size === "lg" ? 14 : 8,
        paddingVertical: size === "lg" ? 7 : 3,
        borderRadius: 20,
        backgroundColor: isCOD ? "#FEE2E2" : "#D1FAE5",
        alignSelf: "flex-start",
      }}
    >
      <Text
        style={{
          fontSize: size === "lg" ? 14 : 12,
          fontWeight: "700",
          color: isCOD ? "#DC2626" : "#059669",
        }}
      >
        {isCOD
          ? `💵 ${t("CASH — COLLECT")}`
          : `💳 ${t("PAID ONLINE")}`}
      </Text>
    </View>
  );
}
