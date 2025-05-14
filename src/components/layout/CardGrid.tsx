'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { CardProps } from '../../types';
import CardFactory from '../cards/CardFactory';

// Type mapping for section titles
const TYPE_LABELS = {
  'image': 'Images',
  'social': 'Posts',
  'reel': 'Reels'
};

interface CardGridProps {
  initialCards: CardProps[];
  loadMore: (page: number) => Promise<CardProps[]>;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  isAdmin?: boolean;
  selectedTypes?: string[]; // Added to know whether to group by type
}

const CardGrid: React.FC<CardGridProps> = ({ 
  initialCards, 
  loadMore, 
  onEdit, 
  onDelete,
  isAdmin = false,
  selectedTypes = []
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

  const loadMoreCards = useCallback(async () => {
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
  }, [loading, hasMore, page, loadMore]);

  const lastCardRef = useCallback((node: HTMLDivElement) => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        loadMoreCards();
      }
    });

    if (node) observer.current.observe(node);
  }, [loading, hasMore, loadMoreCards]);

  // Function to render a single card (with or without lastCardRef)
  const renderCard = (card: CardProps, isLast: boolean = false) => {
    return (
      <div key={card.id} ref={isLast ? lastCardRef : undefined}>
        <CardFactory 
          {...card} 
          onEdit={onEdit}
          onDelete={onDelete}
          isAdmin={isAdmin}
        />
      </div>
    );
  };

  // Group cards by type if no specific type is selected (All Types view)
  const renderGroupedCards = () => {
    // If a specific type is selected, just render without grouping
    if (selectedTypes.length > 0) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {cards.map((card, index) => renderCard(card, cards.length === index + 1))}
        </div>
      );
    }

    // For "All Types" view, group cards by type
    const cardsByType: Record<string, CardProps[]> = {};
    
    // Group the cards by their type
    cards.forEach(card => {
      if (!cardsByType[card.type]) {
        cardsByType[card.type] = [];
      }
      cardsByType[card.type].push(card);
    });

    // Order the types for consistent display
    const orderedTypes = ['image', 'social', 'reel'].filter(type => cardsByType[type]?.length > 0);

    // Render each group with a header
    return (
      <div className="space-y-8">
        {orderedTypes.map((type, typeIndex) => (
          <div key={type} className="space-y-4">
            {/* Section header */}
            <h2 className="text-2xl font-semibold text-gray-800 border-b border-gray-200 pb-2">
              {TYPE_LABELS[type as keyof typeof TYPE_LABELS] || 'Other'}
            </h2>
            
            {/* Card grid for this type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {cardsByType[type].map((card, cardIndex) => {
                // Set ref only for the very last card of the last type group
                const isLastCard = (typeIndex === orderedTypes.length - 1) && 
                                  (cardIndex === cardsByType[type].length - 1);
                return renderCard(card, isLastCard);
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      {renderGroupedCards()}
      
      {loading && (
        <div className="flex justify-center p-4 mt-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}
    </div>
  );
};

export default CardGrid;