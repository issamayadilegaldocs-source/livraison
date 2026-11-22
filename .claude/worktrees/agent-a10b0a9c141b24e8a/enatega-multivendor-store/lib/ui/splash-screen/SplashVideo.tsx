import { VideoView, useVideoPlayer } from "expo-video";
import { useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";

interface ISplashVideoProps {
  onLoaded: () => void;
  onFinish: () => void;
}

export default function SplashVideo({ onLoaded, onFinish }: ISplashVideoProps) {
  const [hasLoaded, setHasLoaded] = useState(false);
  const [hasFinished, setHasFinished] = useState(false);
  const appState = useRef(AppState.currentState);

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const player = useVideoPlayer(
    require("../../assets/video/mobile-splash.mp4"),
    (player) => {
      player.loop = false;
      player.muted = true;
    },
  );

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
    }, 500);

    const statusSubscription = player.addListener("statusChange", (payload) => {
      if (payload.status === "readyToPlay" && !hasLoaded) {
        setHasLoaded(true);
        onLoaded?.();
        if (AppState.currentState === "active") {
          player.play();
        }
      }
    });

    const endSubscription = player.addListener("playToEnd", () => {
      if (!hasFinished) {
        setHasFinished(true);
        onFinish?.();
      }
    });

    return () => {
      clearTimeout(playTimeout);
      statusSubscription?.remove();
      endSubscription?.remove();
    };
  }, [player, hasLoaded, hasFinished, onLoaded, onFinish]);

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
