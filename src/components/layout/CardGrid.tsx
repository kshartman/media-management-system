'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { CardProps } from '../../types';
import CardFactory from '../cards/CardFactory';

interface CardGridProps {
  initialCards: CardProps[];
  loadMore: (page: number) => Promise<CardProps[]>;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  isAdmin?: boolean;
}

const CardGrid: React.FC<CardGridProps> = ({ 
  initialCards, 
  loadMore, 
  onEdit, 
  onDelete,
  isAdmin = false
}) => {
  const [cards, setCards] = useState<CardProps[]>(initialCards);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  
  // Update cards when initialCards changes
  useEffect(() => {
    setCards(initialCards);
    setPage(1);
    setHasMore(true);
  }, [initialCards]);
  
  // Initialize the observer ref with null initially
  const observer = useRef<IntersectionObserver | null>(null);
  
  const lastCardRef = useCallback((node: HTMLDivElement) => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        loadMoreCards();
      }
    });
    
    if (node) observer.current.observe(node);
  }, [loading, hasMore]);

  const loadMoreCards = async () => {
    if (loading || !hasMore) return;
    
    setLoading(true);
    try {
      const nextPage = page + 1;
      const newCards = await loadMore(nextPage);
      
      if (newCards.length === 0) {
        setHasMore(false);
      } else {
        setCards(prev => [...prev, ...newCards]);
        setPage(nextPage);
      }
    } catch (error) {
      console.error('Error loading more cards:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {cards.map((card, index) => {
        if (cards.length === index + 1) {
          return (
            <div key={card.id} ref={lastCardRef}>
              <CardFactory 
                {...card} 
                onEdit={onEdit}
                onDelete={onDelete}
                isAdmin={isAdmin}
              />
            </div>
          );
        }
        return (
          <div key={card.id}>
            <CardFactory 
              {...card}
              onEdit={onEdit}
              onDelete={onDelete}
              isAdmin={isAdmin}
            />
          </div>
        );
      })}
      
      {loading && (
        <div className="col-span-full flex justify-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}
    </div>
  );
};

export default CardGrid;