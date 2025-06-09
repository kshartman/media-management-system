'use client';

import { createContext, useContext, useState, useRef, ReactNode, useEffect } from 'react';

type SocialSlideContextType = {
  currentlyPlayingId: string | null;
  playSocialSlide: (id: string) => void;
  stopAllSlides: () => void;
  isPlaying: (id: string) => boolean;
};

// Create the context with a default value
const SocialSlideContext = createContext<SocialSlideContextType>({
  currentlyPlayingId: null,
  playSocialSlide: () => {},
  stopAllSlides: () => {},
  isPlaying: () => false,
});

// Custom hook for using the social slide context
export const useSocialSlide = () => useContext(SocialSlideContext);

// Provider component
export const SocialSlideProvider = ({ children }: { children: ReactNode }) => {
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  const timersRef = useRef<Record<string, NodeJS.Timeout>>({});
  
  // Clean up timers when component unmounts
  useEffect(() => {
    return () => {
      // Clear all timers on unmount
      const currentTimers = timersRef.current;
      Object.keys(currentTimers).forEach(key => {
        clearTimeout(currentTimers[key]);
      });
    };
  }, []);

  // Play a slideshow with the given ID
  const playSocialSlide = (id: string) => {
    // Stop current slideshow if there is one and it's different from the new one
    if (currentlyPlayingId && currentlyPlayingId !== id) {
      stopAllSlides();
    }
    
    // Update the current playing ID
    setCurrentlyPlayingId(id);
  };

  // Stop all slideshows
  const stopAllSlides = () => {
    if (currentlyPlayingId) {
      // Clear any active timers for this slideshow
      if (timersRef.current[currentlyPlayingId]) {
        clearTimeout(timersRef.current[currentlyPlayingId]);
        delete timersRef.current[currentlyPlayingId];
      }
      
      setCurrentlyPlayingId(null);
    }
  };

  // Check if a slideshow is currently playing
  const isPlaying = (id: string) => {
    return currentlyPlayingId === id;
  };

  const contextValue = {
    currentlyPlayingId,
    playSocialSlide,
    stopAllSlides,
    isPlaying,
  };

  return (
    <SocialSlideContext.Provider value={contextValue}>
      {children}
    </SocialSlideContext.Provider>
  );
};