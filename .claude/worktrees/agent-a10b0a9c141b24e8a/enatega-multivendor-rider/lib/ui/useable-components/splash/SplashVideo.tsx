import { StyleSheet, View } from 'react-native';
import { useRef, useEffect } from 'react';
import { VideoView, useVideoPlayer, VideoPlayer } from 'expo-video';

interface SplashVideoProps {
  onLoaded?: () => void;
  onFinish?: () => void;
}

export default function SplashVideo({ onLoaded, onFinish }: SplashVideoProps) {
  const hasLoadedRef = useRef(false);
  const hasFinishedRef = useRef(false);
  const playerRef = useRef<VideoPlayer | null>(null);

  const player = useVideoPlayer(require("@/lib/assets/video/mobile-splash.mp4"), (player) => {
    playerRef.current = player;
    player.loop = false;
    player.muted = true;
    player.play();
  });

  useEffect(() => {
    const fireLoaded = () => {
      if (!hasLoadedRef.current) {
        hasLoadedRef.current = true;
        onLoaded?.();
      }
    };
    const fireFinished = () => {
      if (!hasFinishedRef.current) {
        hasFinishedRef.current = true;
        onFinish?.();
      }
    };

    const statusSub = player.addListener('statusChange', (status: any) => {
      if (status.status === 'readyToPlay') fireLoaded();
      if (status.status === 'idle' && hasLoadedRef.current) fireFinished();
    });

    const endSub = player.addListener('playToEnd', () => {
      fireLoaded();
      fireFinished();
    });

    return () => {
      statusSub?.remove();
      endSub?.remove();
    };
  }, [player, onLoaded, onFinish]);

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