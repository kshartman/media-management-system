'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface ScrollContextProps {
  storeScrollPosition: () => void;
  restoreScrollPosition: () => void;
  isScrollPositionStored: boolean;
}

const ScrollContext = createContext<ScrollContextProps>({
  storeScrollPosition: () => {},
  restoreScrollPosition: () => {},
  isScrollPositionStored: false
});

export const useScroll = () => useContext(ScrollContext);

export const ScrollProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [scrollPosition, setScrollPosition] = useState<number | null>(null);
  const [restoredTimestamp, setRestoredTimestamp] = useState<number>(0);

  const storeScrollPosition = useCallback(() => {
    setScrollPosition(window.scrollY);
  }, []);

  const restoreScrollPosition = useCallback(() => {
    if (scrollPosition !== null) {
      // Use requestAnimationFrame to ensure the DOM has updated before scrolling
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollPosition);
        // Update timestamp to trigger any components that need to know when a restoration happened
        setRestoredTimestamp(Date.now());
      });
    }
  }, [scrollPosition]);

  // Cleanup scroll position after restoration
  useEffect(() => {
    if (restoredTimestamp > 0) {
      // Wait a short period to ensure scrolling is complete
      const timer = setTimeout(() => {
        setScrollPosition(null);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [restoredTimestamp]);

  const value = {
    storeScrollPosition,
    restoreScrollPosition,
    isScrollPositionStored: scrollPosition !== null
  };

  return (
    <ScrollContext.Provider value={value}>
      {children}
    </ScrollContext.Provider>
  );
};