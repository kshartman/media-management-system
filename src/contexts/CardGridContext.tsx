'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { CardProps } from '../types';

interface CardGridContextValue {
  allCards: CardProps[];
  openLightbox: (cardId: string, imageIndex?: number) => void;
}

const CardGridContext = createContext<CardGridContextValue | null>(null);

export const useCardGrid = () => {
  const context = useContext(CardGridContext);
  if (!context) {
    throw new Error('useCardGrid must be used within a CardGridProvider');
  }
  return context;
};

interface CardGridProviderProps {
  children: ReactNode;
  cards: CardProps[];
  onOpenLightbox: (cards: CardProps[], cardId: string, imageIndex?: number) => void;
}

export const CardGridProvider: React.FC<CardGridProviderProps> = ({
  children,
  cards,
  onOpenLightbox
}) => {
  const openLightbox = (cardId: string, imageIndex: number = 0) => {
    onOpenLightbox(cards, cardId, imageIndex);
  };

  const value: CardGridContextValue = {
    allCards: cards,
    openLightbox
  };

  return (
    <CardGridContext.Provider value={value}>
      {children}
    </CardGridContext.Provider>
  );
};