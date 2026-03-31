import { useState, useRef, useEffect, useCallback } from "react";

interface SlideAudioMap {
  [slideIndex: number]: string; // index -> audio URL
}

export function useSlideAudio() {
  const [audioMap, setAudioMap] = useState<SlideAudioMap>({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
  }, []);

  const playSlideAudio = useCallback(
    (slideIndex: number) => {
      const url = audioMap[slideIndex];
      if (!url) return;

      // If already playing something, stop it first
      if (audioRef.current) {
        audioRef.current.pause();
      }

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onplay = () => setIsPlaying(true);
      audio.onended = () => setIsPlaying(false);
      audio.onpause = () => setIsPlaying(false);
      audio.onerror = () => setIsPlaying(false);

      audio.play().catch(() => setIsPlaying(false));
    },
    [audioMap]
  );

  const pauseAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
  }, []);

  const toggleAutoPlay = useCallback(() => {
    setAutoPlay((prev) => !prev);
  }, []);

  const onSlideChange = useCallback(
    (newSlideIndex: number) => {
      // Stop current audio on slide change
      stopAudio();

      // Auto-play next slide's audio if enabled
      if (autoPlay && audioMap[newSlideIndex]) {
        // Small delay to let the slide transition happen
        setTimeout(() => {
          playSlideAudio(newSlideIndex);
        }, 300);
      }
    },
    [autoPlay, audioMap, stopAudio, playSlideAudio]
  );

  const setSlideAudio = useCallback(
    (slideIndex: number, url: string) => {
      setAudioMap((prev) => ({ ...prev, [slideIndex]: url }));
    },
    []
  );

  const setAllSlideAudio = useCallback(
    (map: SlideAudioMap) => {
      setAudioMap(map);
    },
    []
  );

  const hasAudio = useCallback(
    (slideIndex: number) => !!audioMap[slideIndex],
    [audioMap]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return {
    audioMap,
    isPlaying,
    autoPlay,
    playSlideAudio,
    pauseAudio,
    toggleAutoPlay,
    onSlideChange,
    setSlideAudio,
    setAllSlideAudio,
    hasAudio,
    stopAudio,
  };
}
