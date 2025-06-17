'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { trackCardDownload } from '../../lib/api';

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
  onNavigateCard?: (direction: 'next' | 'prev') => void;
  canNavigateCard?: {
    prev: boolean;
    next: boolean;
  };
  cardInfo?: {
    current: number;
    total: number;
    type: string;
  };
  cardId?: string;
}

const Lightbox: React.FC<LightboxProps> = ({
  images,
  isOpen,
  onClose,
  initialIndex = 0,
  autoPlay = false,
  interval = 5000,
  imageMetadata,
  onNavigateCard,
  canNavigateCard,
  cardInfo,
  cardId
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const imagesCount = images.length;

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

  // Close the lightbox when pressing Escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      } else if (event.key === 'ArrowLeft') {
        if (event.shiftKey && onNavigateCard && canNavigateCard?.prev) {
          // Shift + Left Arrow = Previous card
          onNavigateCard('prev');
        } else {
          // Left Arrow = Previous image
          goToPrevious();
        }
      } else if (event.key === 'ArrowRight') {
        if (event.shiftKey && onNavigateCard && canNavigateCard?.next) {
          // Shift + Right Arrow = Next card
          onNavigateCard('next');
        } else {
          // Right Arrow = Next image
          goToNext();
        }
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
  }, [isOpen, currentIndex, isPlaying, imagesCount, goToNext, goToPrevious, onClose, togglePlay, onNavigateCard, canNavigateCard]);

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
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          onClose();
        }
      }}
      tabIndex={0}
    >
      <div 
        className="w-full h-full max-w-7xl flex flex-col items-center justify-center p-4"
        role="document"
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
          <div className="relative flex items-center justify-center w-full h-[80vh]">
            {images.map((src, index) => (
              <div 
                key={src}
                className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ease-in-out ${
                  index === currentIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
                }`}
              >
                <Image
                  src={src}
                  alt={imageMetadata?.captions?.[index] || `Image ${index + 1} of ${images.length}`}
                  width={0}
                  height={0}
                  sizes="100vw"
                  style={{ 
                    width: 'auto', 
                    height: 'auto',
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain'
                  }}
                  className="max-w-full max-h-full"
                  priority={index === currentIndex}
                />
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
        <div className="w-full bg-black bg-opacity-60 mt-auto py-4 px-6 relative z-20">
          {/* Left controls */}
          <div className="absolute left-6 top-1/2 -translate-y-1/2 flex items-center gap-3">
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

            {/* Card navigation buttons - only for image cards */}
            {onNavigateCard && canNavigateCard && cardInfo?.type === 'image' && (
              <>
                <button
                  className={`text-white p-2 rounded-full bg-black bg-opacity-50 hover:bg-opacity-70 ${!canNavigateCard.prev ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => canNavigateCard.prev && onNavigateCard('prev')}
                  disabled={!canNavigateCard.prev}
                  aria-label="Previous card (Shift + Left Arrow)"
                  title="Previous card (Shift + Left Arrow)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  className={`text-white p-2 rounded-full bg-black bg-opacity-50 hover:bg-opacity-70 ${!canNavigateCard.next ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => canNavigateCard.next && onNavigateCard('next')}
                  disabled={!canNavigateCard.next}
                  aria-label="Next card (Shift + Right Arrow)"
                  title="Next card (Shift + Right Arrow)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}
          </div>

          {/* Center - Counter and card info - always centered */}
          <div className="flex flex-col items-center text-white text-sm">
            {/* Only show image counter for multiple images (social cards) */}
            {images.length > 1 && (
              <div>
                {currentIndex + 1} / {images.length}
              </div>
            )}
            {cardInfo && (
              <div className={`text-xs text-gray-300 ${images.length > 1 ? 'mt-1' : ''}`}>
                {cardInfo.type} {cardInfo.current} of {cardInfo.total}
              </div>
            )}
          </div>

          {/* Right side - Image name/caption if available */}
          <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-2 text-white text-sm truncate max-w-md">
            {imageMetadata?.names && imageMetadata.names[currentIndex] && (
              <>
                <button
                  onClick={async () => {
                    try {
                      // Fetch the image directly (works after S3 CORS is configured)
                      const response = await fetch(images[currentIndex]);
                      
                      if (!response.ok) throw new Error(`Download failed: ${response.status}`);
                      
                      const blob = await response.blob();
                      
                      // Force download by setting MIME type to octet-stream
                      const downloadBlob = new Blob([blob], { type: 'application/octet-stream' });
                      
                      const url = window.URL.createObjectURL(downloadBlob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = imageMetadata.names?.[currentIndex] || `image-${currentIndex + 1}`;
                      link.style.display = 'none';
                      
                      document.body.appendChild(link);
                      link.click();
                      
                      // Clean up
                      setTimeout(() => {
                        document.body.removeChild(link);
                        window.URL.revokeObjectURL(url);
                      }, 100);

                      // Track the download if cardId is available
                      if (cardId) {
                        try {
                          await trackCardDownload(cardId);
                        } catch (trackError) {
                          console.error('Failed to track download:', trackError);
                        }
                      }
                      
                    } catch (error) {
                      console.error('Download failed:', error);
                      // Fallback: open in new tab (right-click to save)
                      window.open(images[currentIndex], '_blank');
                    }
                  }}
                  className="p-1 rounded hover:bg-white hover:bg-opacity-20 transition-colors"
                  aria-label="Download image"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </button>
                <span className="truncate">
                  {imageMetadata.names[currentIndex]}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Lightbox;