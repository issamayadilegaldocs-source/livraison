import { useApolloClient, useMutation } from "@apollo/client";
import { useContext, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Modal,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

import { useApptheme } from "@/lib/context/global/theme.context";
import { useUserContext } from "@/lib/context/global/user.context";
import { useSoundContext } from "@/lib/context/global/sound.context";
import {
  ASSIGN_ORDER,
  REJECT_RIDER_ASSIGNMENT,
} from "@/lib/apollo/mutations/order.mutation";
import { ConfigurationContext } from "@/lib/context/global/configuration.context";
import { calculateDistance } from "@/lib/utils/methods/custom-functions";
import PaymentMethodBadge from "@/lib/ui/useable-components/payment-method-badge";

const TIMEOUT_SECONDS = 30;
const RING_VIBRATION = [0, 300, 200, 300, 200, 300];

export default function IncomingOrderModal() {
  const { t } = useTranslation();
  const { appTheme } = useApptheme();
  const { incomingOrder, setIncomingOrder, refetchAssigned } = useUserContext();
  const configuration = useContext(ConfigurationContext);
  const client = useApolloClient();
  const { playSound, stopSound } = useSoundContext();

  const [countdown, setCountdown] = useState(TIMEOUT_SECONDS);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vibrationRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [claimOrder, { loading: loadingAccept }] = useMutation(ASSIGN_ORDER);
  const [rejectAssignment, { loading: loadingReject }] = useMutation(
    REJECT_RIDER_ASSIGNMENT
  );

  const dismiss = () => {
    setIncomingOrder(null);
    setCountdown(TIMEOUT_SECONDS);
    Vibration.cancel();
    stopSound();
    if (timerRef.current) clearInterval(timerRef.current);
    if (vibrationRef.current) clearInterval(vibrationRef.current);
  };

  const handleAccept = async () => {
    if (!incomingOrder) return;
    try {
      await claimOrder({ variables: { id: incomingOrder._id } });
      await refetchAssigned();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("already claimed") || msg.includes("ConflictException")) {
        Alert.alert(t("Order taken"), t("This order was already claimed by another rider."));
      } else {
        console.log("[IncomingOrderModal] accept error", e);
      }
    } finally {
      dismiss();
    }
  };

  const handleReject = async () => {
    if (!incomingOrder) return;
    const rejectedId = incomingOrder._id;
    // Two different rings share this modal: an admin "call" assignment (the
    // order is already assigned to this rider, so rejecting must tell the
    // backend to release it) vs. a zone broadcast of a freshly-PREPARED order
    // (no rider assigned yet — any rider in the zone may be ringing for the
    // same order). rejectRiderAssignment throws ForbiddenException for the
    // latter ("Order is not assigned to you"), so only call it when there's
    // an actual assignment to undo.
    const hasAssignment = !!incomingOrder.rider;
    try {
      if (hasAssignment) {
        await rejectAssignment({ variables: { id: rejectedId } });
      }
      // Evict from this rider's own cache so the list/sound stop immediately
      // for them; other riders still ringing for the same zone order are
      // unaffected until someone actually claims it (origin "remove").
      client.cache.evict({
        id: client.cache.identify({ __typename: "Order", _id: rejectedId }),
      });
      client.cache.gc();
      if (hasAssignment) await refetchAssigned();
    } catch (e) {
      console.log("[IncomingOrderModal] reject error", e);
    } finally {
      dismiss();
    }
  };

  useEffect(() => {
    if (!incomingOrder) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.12,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [incomingOrder]);

  // Countdown + auto-reject on timeout
  useEffect(() => {
    if (!incomingOrder) return;
    setCountdown(TIMEOUT_SECONDS);

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          handleReject();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [incomingOrder]);

  useEffect(() => {
    if (!incomingOrder) return;
    const vibrate = () => Vibration.vibrate(RING_VIBRATION);
    vibrate();
    vibrationRef.current = setInterval(vibrate, 2000);
    playSound();
    return () => {
      Vibration.cancel();
      stopSound();
      if (vibrationRef.current) clearInterval(vibrationRef.current);
    };
  }, [incomingOrder]);

  if (!incomingOrder) return null;

  const distance = calculateDistance(
    Number(incomingOrder.restaurant?.location?.coordinates[0]),
    Number(incomingOrder.restaurant?.location?.coordinates[1]),
    incomingOrder.deliveryAddress?.location?.coordinates[0],
    incomingOrder.deliveryAddress?.location?.coordinates[1]
  );

  return (
    <Modal transparent animationType="none" visible={!!incomingOrder}>
      <View
        style={{
          flex: 1,
          backgroundColor: appTheme.screenBackground,
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: 60,
          paddingBottom: 40,
        }}
      >
        {/* Top section: Contact info */}
        <View style={{ alignItems: "center", gap: 12 }}>
          {/* Pulse animation ring */}
          <Animated.View
            style={{
              transform: [{ scale: pulseAnim }],
              backgroundColor: appTheme.primary,
              borderRadius: 999,
              width: 140,
              height: 140,
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <Text style={{ fontSize: 60 }}>🍽️</Text>
          </Animated.View>

          {/* Restaurant name (like caller ID) */}
          <Text
            style={{
              color: appTheme.fontMainColor,
              fontSize: 28,
              fontWeight: "700",
              textAlign: "center",
            }}
          >
            {incomingOrder.restaurant?.name}
          </Text>

          {/* Countdown timer - large and visible */}
          <Text
            style={{
              color: countdown <= 10 ? "#ef4444" : appTheme.primary,
              fontSize: 20,
              fontWeight: "600",
              marginTop: 8,
            }}
          >
            {countdown}s
          </Text>
        </View>

        {/* Middle section: Order details card */}
        <View
          style={{
            backgroundColor: appTheme.themeBackground,
            borderRadius: 12,
            padding: 16,
            width: "90%",
            gap: 10,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: appTheme.fontSecondColor, fontSize: 12 }}>
                Restaurant
              </Text>
              <Text
                style={{
                  color: appTheme.fontMainColor,
                  fontWeight: "600",
                  fontSize: 13,
                }}
              >
                {incomingOrder.restaurant?.address?.substring(0, 40)}
              </Text>
            </View>
            <Text style={{ color: appTheme.fontMainColor, fontWeight: "700", fontSize: 18 }}>
              {configuration?.currencySymbol}
              {incomingOrder.orderAmount}
            </Text>
          </View>

          <View style={{ borderTopColor: appTheme.fontSecondColor, borderTopWidth: 0.5, paddingTop: 10 }}>
            <Text style={{ color: appTheme.fontSecondColor, fontSize: 12 }}>
              Delivery
            </Text>
            <Text
              style={{
                color: appTheme.fontMainColor,
                fontWeight: "600",
                fontSize: 13,
              }}
            >
              {incomingOrder.deliveryAddress?.deliveryAddress?.substring(0, 40)}
            </Text>
            <Text style={{ color: appTheme.fontSecondColor, fontSize: 12, marginTop: 4 }}>
              📍 {distance.toFixed(1)} km away
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
            <PaymentMethodBadge paymentMethod={incomingOrder.paymentMethod} size="lg" />
          </View>

          {/* Earnings breakdown: commission + platform-funded bonus = total expected */}
          {(() => {
            const rate = configuration?.riderCommissionRate ?? 0;
            const commission = incomingOrder.riderCommission ?? (incomingOrder.deliveryCharges ?? 0) * rate;
            const bonus = incomingOrder.deliveryBonus ?? 0;
            const total = commission + bonus;
            if (total <= 0) return null;
            const symbol = configuration?.currencySymbol;
            return (
              <View style={{ marginTop: 8, paddingTop: 8, borderTopColor: appTheme.fontSecondColor, borderTopWidth: 0.5 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: appTheme.fontSecondColor, fontSize: 12 }}>
                    {t("Your commission")}
                  </Text>
                  <Text style={{ color: appTheme.fontMainColor, fontWeight: "600", fontSize: 13 }}>
                    {symbol}{commission.toFixed(2)}
                  </Text>
                </View>
                {bonus > 0 && (
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                    <Text style={{ color: appTheme.fontSecondColor, fontSize: 12 }}>
                      {t("Bonus")}
                    </Text>
                    <Text style={{ color: appTheme.fontMainColor, fontWeight: "600", fontSize: 13 }}>
                      {symbol}{bonus.toFixed(2)}
                    </Text>
                  </View>
                )}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                  <Text style={{ color: appTheme.fontSecondColor, fontSize: 12 }}>
                    {t("Total expected")}
                  </Text>
                  <Text style={{ color: "#22c55e", fontWeight: "700", fontSize: 15 }}>
                    {symbol}{total.toFixed(2)}
                  </Text>
                </View>
              </View>
            );
          })()}
        </View>

        {/* Bottom section: Answer/Reject buttons - like phone call UI */}
        <View style={{ flexDirection: "row", gap: 24, width: "100%", paddingHorizontal: 40 }}>
          {/* Reject button - Red, circular */}
          <TouchableOpacity
            disabled={loadingReject || loadingAccept}
            onPress={handleReject}
            style={{
              flex: 1,
              backgroundColor: "#ef4444",
              borderRadius: 80,
              paddingVertical: 18,
              paddingHorizontal: 24,
              alignItems: "center",
              justifyContent: "center",
              elevation: 5,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 24 }}>
              ✕
            </Text>
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 12, marginTop: 4 }}>
              {t("Reject")}
            </Text>
          </TouchableOpacity>

          {/* Accept button - Green, circular */}
          <TouchableOpacity
            disabled={loadingAccept || loadingReject}
            onPress={handleAccept}
            style={{
              flex: 1,
              backgroundColor: "#22c55e",
              borderRadius: 80,
              paddingVertical: 18,
              paddingHorizontal: 24,
              alignItems: "center",
              justifyContent: "center",
              elevation: 5,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 24 }}>
              ✓
            </Text>
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 12, marginTop: 4 }}>
              {t("Accept")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
