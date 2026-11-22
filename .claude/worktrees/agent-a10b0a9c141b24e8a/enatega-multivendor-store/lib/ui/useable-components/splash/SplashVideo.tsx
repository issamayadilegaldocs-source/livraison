/* eslint-disable @typescript-eslint/no-require-imports */
import { VideoView, useVideoPlayer } from "expo-video";
import { AppState, StyleSheet, View } from "react-native";
import { useRef, useEffect } from "react";

interface ISplashVideoProps {
  onLoaded: () => void;
  onFinish: () => void;
}

export default function SplashVideo({ onLoaded, onFinish }: ISplashVideoProps) {
  const calledRef = useRef(false);
  const appState = useRef(AppState.currentState);

  const player = useVideoPlayer(
    require("@/lib/assets/video/mobile-splash.mp4"),
    (player) => {
      player.loop = false;
      player.muted = true;
    },
  );

  const safeComplete = () => {
    if (calledRef.current) return;
    calledRef.current = true;
    onLoaded();
    onFinish();
  };

  // Fallback: if the video doesn't load within 3 seconds, skip splash
  useEffect(() => {
    const t = setTimeout(safeComplete, 3000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (appState.current.match(/active/) && nextAppState === "background") {
        player.pause();
      }
      appState.current = nextAppState;
    });

    return () => subscription?.remove();
  }, [player]);

  useEffect(() => {
    const playTimeout = setTimeout(() => {
      if (AppState.currentState === "active") {
        player.play();
      }
    }, 300);

    const statusSubscription = player.addListener("statusChange", (payload) => {
      if (payload.status === "readyToPlay") {
        onLoaded?.();
        if (AppState.currentState === "active") {
          player.play();
        }
      }
      if (payload.status === "error") {
        safeComplete();
      }
    });

    const endSubscription = player.addListener("playToEnd", () => {
      safeComplete();
    });

    return () => {
      clearTimeout(playTimeout);
      statusSubscription?.remove();
      endSubscription?.remove();
    };
  }, [player]);

  return (
    <View style={{ flex: 1 }}>
      <VideoView
        style={StyleSheet.absoluteFill}
        player={player}
        allowsPictureInPicture={false}
        nativeControls={false}
        contentFit="cover"
      />
    </View>
  );
}
