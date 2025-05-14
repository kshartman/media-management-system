'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

interface LightboxProps {
  images: string[];
  isOpen: boolean;
  onClose: () => void;
  initialIndex?: number;
  autoPlay?: boolean;
  interval?: number;
  imageMetadata?: {
    names?: string[];
    captions?: string[];
  };
}

const Lightbox: React.FC<LightboxProps> = ({
  images,
  isOpen,
  onClose,
  initialIndex = 0,
  autoPlay = false,
  interval = 5000,
  imageMetadata
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const imagesCount = images.length;

  // Close the lightbox when pressing Escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      } else if (event.key === 'ArrowLeft') {
        goToPrevious();
      } else if (event.key === 'ArrowRight') {
        goToNext();
      } else if (event.key === ' ') {
        // Space bar toggles play/pause
        event.preventDefault();
        togglePlay();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scrolling when lightbox is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, currentIndex, isPlaying, imagesCount]);

  // Handle auto-play functionality
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    if (isOpen && isPlaying && imagesCount > 1) {
      timer = setTimeout(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % imagesCount);
      }, interval);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isOpen, isPlaying, currentIndex, interval, imagesCount]);

  // Navigation functions
  const goToNext = useCallback(() => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % imagesCount);
  }, [imagesCount]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + imagesCount) % imagesCount);
  }, [imagesCount]);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  // Touch event handlers for swipe navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;
    
    // If the swipe is significant (more than 50px)
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        // Swiped left, go to next
        goToNext();
      } else {
        // Swiped right, go to previous
        goToPrevious();
      }
    }
    
    setTouchStart(null);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center"
      onClick={onClose}
    >
      <div 
        className="w-full h-full max-w-7xl flex flex-col items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
      >
        {/* Close button */}
        <button 
          className="absolute top-4 right-4 text-white z-10 p-2 rounded-full bg-black bg-opacity-50 hover:bg-opacity-70"
          onClick={onClose}
          aria-label="Close lightbox"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Image container */}
        <div 
          className="relative w-full h-full flex items-center justify-center"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="relative w-full h-[70vh] max-w-full max-h-full">
            {images.map((src, index) => (
              <div 
                key={src}
                className={`absolute top-0 left-0 w-full h-full transition-opacity duration-300 ease-in-out ${
                  index === currentIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
                }`}
              >
                <div className="relative w-full h-full">
                  <Image
                    src={src}
                    alt={imageMetadata?.captions?.[index] || `Image ${index + 1} of ${images.length}`}
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Navigation buttons */}
          {images.length > 1 && (
            <>
              <button 
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white z-10 p-3 rounded-full bg-black bg-opacity-50 hover:bg-opacity-70"
                onClick={(e) => {
                  e.stopPropagation();
                  goToPrevious();
                }}
                aria-label="Previous image"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button 
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white z-10 p-3 rounded-full bg-black bg-opacity-50 hover:bg-opacity-70"
                onClick={(e) => {
                  e.stopPropagation();
                  goToNext();
                }}
                aria-label="Next image"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}
        </div>

        {/* Controls footer */}
        <div className="w-full bg-black bg-opacity-60 mt-auto py-4 px-6 flex items-center justify-between z-20">
          {/* Play/pause button */}
          {images.length > 1 && (
            <button 
              className="text-white p-2 rounded-full bg-black bg-opacity-50 hover:bg-opacity-70"
              onClick={togglePlay}
              aria-label={isPlaying ? "Pause slideshow" : "Play slideshow"}
            >
              {isPlaying ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </button>
          )}

          {/* Counter */}
          <div className="text-white text-sm">
            {currentIndex + 1} / {images.length}
          </div>

          {/* Image name/caption if available */}
          <div className="text-white text-sm truncate max-w-md">
            {imageMetadata?.names && imageMetadata.names[currentIndex] ? 
              imageMetadata.names[currentIndex] : ''}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Lightbox;