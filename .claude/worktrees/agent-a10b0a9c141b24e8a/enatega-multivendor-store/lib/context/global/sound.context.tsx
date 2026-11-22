/* eslint-disable @typescript-eslint/no-require-imports */
import { useContext, useEffect, useState, createContext } from "react";
import { AudioPlayer, useAudioPlayer, AudioSource } from "expo-audio";
// Interface
import {
  ISoundContext,
  ISoundContextProviderProps,
} from "@/lib/utils/interfaces";
// Context/Hooks

// Hook
import useOrders from "@/lib/hooks/useOrders";

const SoundContext = createContext<ISoundContext>({} as ISoundContext);

export const SoundProvider = ({ children }: ISoundContextProviderProps) => {
  // State
  const [audioPlayer, setAudioPlayer] = useState<AudioPlayer | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Context/Hooks
  const { hasNewOrders } = useOrders();

  // Create audio player
  const player = useAudioPlayer(
    require("@/lib/assets/sound/beep3.mp3") as AudioSource,
  );

  // Handlers
  const playSound = async () => {
    try {
      await stopSound();

      // Note: expo-audio handles audio session configuration automatically.
      player.loop = true;
      player.play();
      setAudioPlayer(player);
      setIsPlaying(true);
    } catch (err) {
      console.log("Error playing sound:", err);
    }
  };

  const stopSound = async () => {
    if (audioPlayer && isPlaying) {
      try {
        audioPlayer.pause();
        setIsPlaying(false);
      } catch (err) {
        console.log("Error stopping sound:", err);
      }
    }
  };

  // Audio player event listeners
  useEffect(() => {
    const statusSubscription = player.addListener(
      "playbackStatusUpdate",
      (status) => {
        setIsPlaying(status.playing);
      },
    );

    return () => {
      statusSubscription?.remove();
    };
  }, [player]);

  // Use Effect
  useEffect(() => {
    if (hasNewOrders) {
      const shouldPlaySound = hasNewOrders;

      if (shouldPlaySound && !isPlaying) {
        playSound();
      } else if (!shouldPlaySound && isPlaying) {
        stopSound();
      }
    } else {
      stopSound();
    }

    return () => {
      if (isPlaying) {
        stopSound();
      }
    };
  }, [hasNewOrders, isPlaying]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        if (isPlaying) {
          player.pause();
        }
      } catch (err) {
        // Player may already be released by expo-audio on teardown.
        console.log("Error pausing sound on unmount:", err);
      }
    };
  }, []);

  return (
    <SoundContext.Provider value={{ playSound, stopSound }}>
      {children}
    </SoundContext.Provider>
  );
};
export const SoundContextConsumer = SoundContext.Consumer;
export const useSoundContext = () => useContext(SoundContext);
export default SoundContext;
