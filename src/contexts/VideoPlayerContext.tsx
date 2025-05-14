'use client';

import { createContext, useContext, useState, useRef, ReactNode } from 'react';

type VideoContextType = {
  currentlyPlayingId: string | null;
  playVideo: (id: string) => void;
  stopAllVideos: () => void;
  isPlaying: (id: string) => boolean;
  registerVideoRef: (id: string, ref: HTMLVideoElement) => void;
};

// Create the context with a default value
const VideoPlayerContext = createContext<VideoContextType>({
  currentlyPlayingId: null,
  playVideo: () => {},
  stopAllVideos: () => {},
  isPlaying: () => false,
  registerVideoRef: () => {},
});

// Custom hook for using the video context
export const useVideoPlayer = () => useContext(VideoPlayerContext);

// Provider component
export const VideoPlayerProvider = ({ children }: { children: ReactNode }) => {
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement>>({});

  // Play a video with the given ID
  const playVideo = (id: string) => {
    // Stop current video if there is one
    if (currentlyPlayingId && currentlyPlayingId !== id) {
      const currentVideo = videoRefs.current[currentlyPlayingId];
      if (currentVideo) {
        currentVideo.pause();
      }
    }
    
    // Update the current playing ID
    setCurrentlyPlayingId(id);
  };

  // Stop all videos
  const stopAllVideos = () => {
    if (currentlyPlayingId) {
      const currentVideo = videoRefs.current[currentlyPlayingId];
      if (currentVideo) {
        currentVideo.pause();
      }
      setCurrentlyPlayingId(null);
    }
  };

  // Check if a video is currently playing
  const isPlaying = (id: string) => {
    return currentlyPlayingId === id;
  };

  // Register a video ref with its ID
  const registerVideoRef = (id: string, ref: HTMLVideoElement) => {
    videoRefs.current[id] = ref;
  };

  const contextValue = {
    currentlyPlayingId,
    playVideo,
    stopAllVideos,
    isPlaying,
    registerVideoRef,
  };

  return (
    <VideoPlayerContext.Provider value={contextValue}>
      {children}
    </VideoPlayerContext.Provider>
  );
};