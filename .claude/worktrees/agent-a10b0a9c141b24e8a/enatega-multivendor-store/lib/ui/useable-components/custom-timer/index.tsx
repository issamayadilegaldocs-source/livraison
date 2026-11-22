import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

// Hooks
import { useApptheme } from "@/lib/context/theme.context";

interface TimerProps {
  // Absolute completion timestamp (e.g. `order.preparationTime`). The countdown
  // is derived from this on every tick so it stays accurate and re-syncs when
  // the value arrives late (cache → network / subscription) instead of locking
  // at 0 forever the way a one-shot `useState(duration)` snapshot would.
  targetTime?: string | number | Date | null;
}

const computeRemaining = (targetTime: TimerProps["targetTime"]): number => {
  if (!targetTime) return 0;
  const target = new Date(targetTime).getTime();
  if (Number.isNaN(target)) return 0;
  const diff = Math.floor((target - Date.now()) / 1000);
  return diff > 0 ? diff : 0;
};

const CountdownTimer: React.FC<TimerProps> = ({ targetTime }) => {
  // Hooks
  const { appTheme } = useApptheme();

  // States
  const [timeLeft, setTimeLeft] = useState(() => computeRemaining(targetTime));

  // UseEffects
  useEffect(() => {
    // Re-sync immediately whenever the deadline changes (handles the case where
    // `preparationTime` is null on first render and populated a moment later).
    setTimeLeft(computeRemaining(targetTime));

    const timer = setInterval(() => {
      const remaining = computeRemaining(targetTime);
      setTimeLeft(remaining);
      if (remaining <= 0) clearInterval(timer);
    }, 1000);

    return () => clearInterval(timer);
  }, [targetTime]);

  // Convert seconds to HH:MM:SS format
  const formatTime = (time: number) => {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);

    return {
      hours: String(hours).padStart(2, "0"),
      minutes: String(minutes).padStart(2, "0"),
      seconds: String(seconds).padStart(2, "0"),
    };
  };

  const { hours, minutes, seconds } = formatTime(timeLeft);
  const isOverdue = hours === "00" && minutes === "00" && seconds === "00";

  return (
    <View style={styles.container}>
      <View style={styles.timerRow}>
        <View style={styles.box}>
          <Text
            style={[
              styles[isOverdue ? "timerTextEnd" : "timerText"],
              { color: appTheme.fontMainColor },
            ]}
          >
            {hours}
          </Text>
        </View>
        <Text style={styles.colon}>:</Text>
        <View style={styles.box}>
          <Text
            style={[
              styles[isOverdue ? "timerTextEnd" : "timerText"],
              { color: appTheme.fontMainColor },
            ]}
          >
            {minutes}
          </Text>
        </View>
        <Text style={styles.colon}>:</Text>
        <View style={styles.box}>
          <Text
            style={[
              styles[isOverdue ? "timerTextEnd" : "timerText"],
              { color: appTheme.fontMainColor },
            ]}
          >
            {seconds}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  box: {
    width: 30,
    height: 30,
    backgroundColor: "transparent",
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  timerText: {
    fontSize: 20,
    fontWeight: "bold",
    // color: "red",
  },
  timerTextEnd: {
    fontSize: 20,
    fontWeight: "bold",
    color: "red",
  },
  colon: {
    fontWeight: "bold",
    color: "red",
    marginHorizontal: 5,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 200,
    marginTop: 5,
  },
  label: {
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
    color: "black",
  },
});

export default CountdownTimer;
