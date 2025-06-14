'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { CardProps } from '../types';
import Lightbox from '../components/ui/Lightbox';

interface LightboxContextValue {
  openLightbox: (cards: CardProps[], currentCardId: string, imageIndex?: number) => void;
  closeLightbox: () => void;
  isOpen: boolean;
}

const LightboxContext = createContext<LightboxContextValue | null>(null);

export const useLightbox = () => {
  const context = useContext(LightboxContext);
  if (!context) {
    throw new Error('useLightbox must be used within a LightboxProvider');
  }
  return context;
};

export const LightboxProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [allCards, setAllCards] = useState<CardProps[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const openLightbox = (cards: CardProps[], currentCardId: string, imageIndex: number = 0) => {
    const cardIndex = cards.findIndex(card => card.id === currentCardId);
    if (cardIndex === -1) return;

    // For image cards, filter to only include other image cards for navigation
    const currentCard = cards[cardIndex];
    const isImageCard = currentCard.type === 'image';
    const filteredCards = isImageCard ? cards.filter(card => card.type === 'image') : cards;
    const filteredIndex = isImageCard ? filteredCards.findIndex(card => card.id === currentCardId) : cardIndex;

    setAllCards(filteredCards);
    setCurrentCardIndex(filteredIndex);
    setCurrentImageIndex(imageIndex);
    setIsOpen(true);
  };

  const closeLightbox = () => {
    setIsOpen(false);
    setCurrentImageIndex(0);
  };

  // Get images from current card
  const getCurrentImages = (): string[] => {
    if (!allCards[currentCardIndex]) return [];
    
    const card = allCards[currentCardIndex];
    switch (card.type) {
      case 'image':
        return [card.preview || card.download].filter((url): url is string => Boolean(url));
      case 'social':
        return card.imageSequence || [];
      case 'reel':
        return [card.preview].filter((url): url is string => Boolean(url));
      default:
        return [];
    }
  };

  // Get metadata for current card
  const getCurrentMetadata = () => {
    if (!allCards[currentCardIndex]) return { names: [], captions: [] };
    
    const card = allCards[currentCardIndex];
    switch (card.type) {
      case 'image':
        return {
          names: [card.fileMetadata?.downloadOriginalFileName || 'Image'],
          captions: [card.description || '']
        };
      case 'social':
        return {
          names: card.fileMetadata?.imageSequenceOriginalFileNames || [],
          captions: card.fileMetadata?.imageSequenceCaptions || []
        };
      case 'reel':
        return {
          names: [card.fileMetadata?.downloadOriginalFileName || 'Video'],
          captions: [card.description || '']
        };
      default:
        return { names: [], captions: [] };
    }
  };

  // Navigate to next/previous card (only for image cards)
  const navigateToCard = (direction: 'next' | 'prev') => {
    const currentCard = allCards[currentCardIndex];
    // Only allow card navigation for image cards
    if (currentCard?.type !== 'image') return;

    if (direction === 'next' && currentCardIndex < allCards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
      setCurrentImageIndex(0);
    } else if (direction === 'prev' && currentCardIndex > 0) {
      setCurrentCardIndex(currentCardIndex - 1);
      setCurrentImageIndex(0);
    }
  };

  const value: LightboxContextValue = {
    openLightbox,
    closeLightbox,
    isOpen
  };

  return (
    <LightboxContext.Provider value={value}>
      {children}
      {isOpen && (
        <Lightbox
          images={getCurrentImages()}
          isOpen={isOpen}
          onClose={closeLightbox}
          initialIndex={currentImageIndex}
          autoPlay={allCards[currentCardIndex]?.type === 'social'}
          interval={5000}
          imageMetadata={getCurrentMetadata()}
          onNavigateCard={navigateToCard}
          canNavigateCard={{
            prev: currentCardIndex > 0,
            next: currentCardIndex < allCards.length - 1
          }}
          cardInfo={{
            current: currentCardIndex + 1,
            total: allCards.length,
            type: allCards[currentCardIndex]?.type || 'unknown'
          }}
        />
      )}
    </LightboxContext.Provider>
  );
};