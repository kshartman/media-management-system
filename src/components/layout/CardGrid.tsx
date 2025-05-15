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
  lastEditedCardId?: string | null; // To track the last edited card
}

const CardGrid: React.FC<CardGridProps> = ({ 
  initialCards, 
  loadMore, 
  onEdit, 
  onDelete,
  isAdmin = false,
  selectedTypes = [],
  lastEditedCardId = null
}) => {
  // Create a ref map to keep track of each card's DOM element
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [cards, setCards] = useState<CardProps[]>(initialCards);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  
  // Update cards when initialCards changes
  useEffect(() => {
    setCards(initialCards);
    setPage(1);
    setHasMore(true);
    
    // Reset viewport check flag when cards change
    viewportCheckRef.current = false;
  }, [initialCards]);
  
  // Initialize the observer ref with null initially
  const observer = useRef<IntersectionObserver | null>(null);
  
  // Ref to track if viewport has enough content
  const viewportCheckRef = useRef<boolean>(false);

  const loadMoreCards = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
      const nextPage = page + 1;
      const newCards = await loadMore(nextPage);

      if (newCards.length === 0) {
        setHasMore(false);
      } else {
        setCards(prev => {
          const combined = [...prev];
          
          // Only add cards that don't already exist
          newCards.forEach(newCard => {
            if (!combined.some(existingCard => existingCard.id === newCard.id)) {
              combined.push(newCard);
            } else {
              console.log(`Skipping duplicate card with ID: ${newCard.id} when loading more`);
            }
          });
          
          return combined;
        });
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
  
  // Check if we need to load more cards to fill the viewport
  useEffect(() => {
    if (cards.length === 0 || loading || !hasMore) return;
    
    // Only run this check if we have initial cards
    const checkViewportAndLoadMore = () => {
      // If content doesn't fill the viewport, load more
      if (document.body.scrollHeight <= window.innerHeight && !viewportCheckRef.current) {
        console.log('Viewport not filled, loading more cards automatically');
        viewportCheckRef.current = true;
        loadMoreCards();
      }
    };
    
    // Delay check slightly to ensure DOM has updated, but not too long
    const timeoutId = setTimeout(checkViewportAndLoadMore, 50);
    
    // Also set a backup timeout with a longer delay in case the first one doesn't trigger
    const backupTimeoutId = setTimeout(() => {
      // Force reset the viewport check flag to ensure we can try again
      viewportCheckRef.current = false;
      checkViewportAndLoadMore();
    }, 500);
    
    return () => {
      clearTimeout(timeoutId);
      clearTimeout(backupTimeoutId);
    };
  }, [cards, loading, hasMore, loadMoreCards]);

  // Function to handle refs for each card
  const setCardRef = useCallback((id: string, element: HTMLDivElement | null) => {
    if (element) {
      cardRefs.current.set(id, element);
    } else {
      cardRefs.current.delete(id);
    }
  }, []);

  // Function to render a single card (with or without lastCardRef)
  const renderCard = (card: CardProps, isLast: boolean = false) => {
    const isLastEdited = card.id === lastEditedCardId;
    
    return (
      <div 
        key={card.id} 
        ref={(el) => {
          // Set the card ref for scroll restoration
          if (el) setCardRef(card.id, el);
          // Also set the infinite scroll ref if this is the last card
          if (isLast) lastCardRef(el);
        }}
        className={isLastEdited ? 'scroll-mt-24 relative' : 'relative'}
      >
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
      
      {!loading && !hasMore && cards.length > 0 && (
        <div className="text-center text-gray-500 mt-8 mb-4 text-sm">
          All cards loaded
        </div>
      )}
      
      {!loading && cards.length === 0 && (
        <div className="text-center text-gray-500 mt-8 p-8">
          <p className="text-lg">No cards found matching your filters.</p>
          <p className="text-sm mt-2">Try changing your filter settings or search criteria.</p>
        </div>
      )}
    </div>
  );
};

export default CardGrid;