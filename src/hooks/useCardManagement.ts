'use client';

import { useState, useEffect } from 'react';
import { CardProps } from '../types';
import { SortOption } from '../components/filters/SortDropdown';
import { fetchCards, deleteCard, getAllTags } from '../lib/api';
import { useAuth } from '../lib/authContext';

interface UseCardManagementOptions {
  defaultTypes?: string[];
  initialSort?: SortOption;
  pageSize?: number;
}

export function useCardManagement(options: UseCardManagementOptions = {}) {
  const { defaultTypes = [], initialSort = 'newest', pageSize = 100 } = options;
  const { isAdmin, isEditor } = useAuth();

  // State management
  const [selectedTypes, setSelectedTypes] = useState<string[]>(defaultTypes);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [currentSort, setCurrentSort] = useState<SortOption>(initialSort);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredCards, setFilteredCards] = useState<CardProps[]>([]);
  const [cards, setCards] = useState<CardProps[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastEditedCardId, setLastEditedCardId] = useState<string | null>(null);
  const [totalCardCount, setTotalCardCount] = useState<number>(0);
  const [showDeleted, setShowDeleted] = useState(false);

  // Helper function to process cards and add isDeleted prop
  const processCardsWithDeletedStatus = (cards: (CardProps & { deletedAt?: string })[]): CardProps[] => {
    return cards.map(card => ({
      ...card,
      isDeleted: !!card.deletedAt
    }));
  };

  // Handle restore card from trash
  const handleRestoreCard = async (cardId: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/cards/trash/${cardId}/restore`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to restore card');
      }

      // Reload cards to reflect the change
      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to restore card');
    }
  };

  // Handle permanent delete card
  const handlePermanentDeleteCard = async (cardId: string) => {
    if (!confirm('Are you sure you want to permanently delete this card? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/cards/trash/${cardId}/permanent`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to permanently delete card');
      }

      // Reload cards to reflect the change
      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to permanently delete card');
    }
  };

  // Apply all filters and sorting
  const applyFiltersAndSort = (
    allCards: CardProps[],
    typeFilter: string[],
    tagFilter: string[],
    sortOption: SortOption,
    searchFilter: string
  ): CardProps[] => {
    let filtered = [...allCards];

    // Apply type filter (if not empty, filter by selected types)
    if (typeFilter.length > 0) {
      filtered = filtered.filter(card => typeFilter.includes(card.type));
    }

    // Apply tag filter (if not empty, filter by selected tags)
    if (tagFilter.length > 0) {
      filtered = filtered.filter(card => 
        tagFilter.every(selectedTag => 
          card.tags.some(cardTag => 
            cardTag.toLowerCase().includes(selectedTag.toLowerCase())
          )
        )
      );
    }

    // Apply search filter
    if (searchFilter.trim()) {
      const searchLower = searchFilter.toLowerCase();
      filtered = filtered.filter(card =>
        card.description.toLowerCase().includes(searchLower) ||
        card.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortOption) {
        case 'newest':
          return new Date(b.fileMetadata?.date || 0).getTime() - new Date(a.fileMetadata?.date || 0).getTime();
        case 'oldest':
          return new Date(a.fileMetadata?.date || 0).getTime() - new Date(b.fileMetadata?.date || 0).getTime();
        case 'alphabetical':
          return a.description.localeCompare(b.description);
        case 'popularity':
          return (b.downloadCount || 0) - (a.downloadCount || 0);
        default:
          return 0;
      }
    });

    return filtered;
  };

  // Load cards data
  const loadData = async () => {
    try {
      setLoading(true);

      const [cardsResponse, tagsResponse] = await Promise.all([
        fetchCards(1, { 
          type: defaultTypes, 
          tags: [], 
          search: '', 
          includeDeleted: showDeleted && (isAdmin || isEditor) 
        }, pageSize),
        getAllTags()
      ]);

      setTotalCardCount(cardsResponse.totalCount);
      const processedCards = processCardsWithDeletedStatus(cardsResponse.cards);
      setCards(processedCards);
      setAvailableTags(tagsResponse);

      const initialFiltered = applyFiltersAndSort(
        processedCards,
        defaultTypes,
        [],
        initialSort,
        ''
      );
      setFilteredCards(initialFiltered);

      // Pre-load more cards if needed
      if (cardsResponse.cards.length < cardsResponse.totalCount) {
        setTimeout(async () => {
          try {
            const page2Response = await fetchCards(2, {
              type: defaultTypes,
              tags: [],
              search: '',
              includeDeleted: showDeleted && (isAdmin || isEditor)
            });

            const combinedCards = [...processedCards];
            page2Response.cards.forEach((newCard: CardProps & { deletedAt?: string }) => {
              if (!combinedCards.some(existingCard => existingCard.id === newCard.id)) {
                combinedCards.push(newCard);
              }
            });

            const processedCombined = processCardsWithDeletedStatus(combinedCards);
            setCards(processedCombined);

            const combinedFiltered = applyFiltersAndSort(
              processedCombined,
              defaultTypes,
              [],
              initialSort,
              ''
            );
            setFilteredCards(combinedFiltered);
          } catch (error) {
            console.error('Error pre-loading page 2:', error);
          }
        }, 100);
      }
    } catch (error) {
      console.error('Error loading cards:', error);
      // Fallback to empty state
      setCards([]);
      setFilteredCards([]);
      setAvailableTags([]);
    } finally {
      setLoading(false);
    }
  };

  // Load data when dependencies change
  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDeleted, isAdmin, isEditor]);

  // Handle filter changes
  const handleFilterChange = async (filters: {
    type?: string[];
    tags?: string[];
    search?: string;
  }) => {
    try {
      // Update states based on what changed
      if (filters.type !== undefined) {
        setSelectedTypes(filters.type);
      }
      if (filters.tags !== undefined) {
        setSelectedTags(filters.tags);
      }

      const types = filters.type !== undefined ? filters.type : selectedTypes;
      const tags = filters.tags !== undefined ? filters.tags : selectedTags;

      // For type filters, fetch from server
      if (filters.type !== undefined) {
        const response = await fetchCards(1, {
          type: types,
          tags: tags,
          search: searchTerm,
          sort: currentSort,
          includeDeleted: showDeleted && (isAdmin || isEditor)
        });

        const processedCards = processCardsWithDeletedStatus(response.cards);
        setCards(processedCards);
        setTotalCardCount(response.totalCount);

        const sorted = applyFiltersAndSort(processedCards, types, tags, currentSort, '');
        setFilteredCards(sorted);

        // Pre-load page 2
        if (response.cards.length < response.totalCount && response.totalCount > 0) {
          setTimeout(async () => {
            try {
              const page2Response = await fetchCards(2, {
                type: types,
                tags: tags,
                search: searchTerm,
                includeDeleted: showDeleted && (isAdmin || isEditor)
              });

              const combinedCards = [...processedCards];
              page2Response.cards.forEach((newCard: CardProps & { deletedAt?: string }) => {
                if (!combinedCards.some(existingCard => existingCard.id === newCard.id)) {
                  combinedCards.push(newCard);
                }
              });

              const processedCombined = processCardsWithDeletedStatus(combinedCards);
              setCards(processedCombined);

              const combinedFiltered = applyFiltersAndSort(processedCombined, types, tags, currentSort, searchTerm);
              setFilteredCards(combinedFiltered);
            } catch (error) {
              console.error('Error loading additional cards:', error);
            }
          }, 100);
        }
      } else {
        // For tag filters, apply client-side
        const filtered = applyFiltersAndSort(cards, types, tags, currentSort, searchTerm);
        setFilteredCards(filtered);
      }
    } catch (error) {
      console.error('Error applying filters:', error);
    }
  };

  // Handle search
  const handleSearch = async (searchValue: string) => {
    try {
      setSearchTerm(searchValue);

      if (searchValue.trim()) {
        const response = await fetchCards(1, {
          type: selectedTypes,
          tags: selectedTags,
          search: searchValue,
          sort: currentSort,
          includeDeleted: showDeleted && (isAdmin || isEditor)
        });

        const processedCards = processCardsWithDeletedStatus(response.cards);
        setCards(processedCards);

        const filtered = applyFiltersAndSort(processedCards, selectedTypes, selectedTags, currentSort, searchValue);
        setFilteredCards(filtered);

        // Pre-load page 2
        if (response.cards.length < response.totalCount && response.totalCount > 0) {
          setTimeout(async () => {
            try {
              const page2Response = await fetchCards(2, {
                type: selectedTypes,
                tags: selectedTags,
                search: searchValue,
                includeDeleted: showDeleted && (isAdmin || isEditor)
              });

              const combinedCards = [...processedCards];
              page2Response.cards.forEach((newCard: CardProps & { deletedAt?: string }) => {
                if (!combinedCards.some(existingCard => existingCard.id === newCard.id)) {
                  combinedCards.push(newCard);
                }
              });

              const processedCombined = processCardsWithDeletedStatus(combinedCards);
              setCards(processedCombined);

              const combinedFiltered = applyFiltersAndSort(processedCombined, selectedTypes, selectedTags, currentSort, searchValue);
              setFilteredCards(combinedFiltered);
            } catch (error) {
              console.error('Error loading additional search results:', error);
            }
          }, 100);
        }
      } else {
        // Empty search, reload all cards
        await loadData();
      }
    } catch (error) {
      console.error('Error searching cards:', error);
    }
  };

  // Handle sort change
  const handleSortChange = (newSort: SortOption) => {
    setCurrentSort(newSort);
    const sorted = applyFiltersAndSort(cards, selectedTypes, selectedTags, newSort, searchTerm);
    setFilteredCards(sorted);
  };

  // Handle edit card
  const handleEditCard = (cardId: string) => {
    const card = filteredCards.find(c => c.id === cardId);
    if (card?.isDeleted) {
      handleRestoreCard(cardId);
    } else {
      // Set for editing
      setLastEditedCardId(cardId);
      // The parent component should handle opening edit modal
    }
  };

  // Handle delete card
  const handleDeleteCard = async (cardId: string) => {
    const card = filteredCards.find(c => c.id === cardId);
    if (card?.isDeleted) {
      await handlePermanentDeleteCard(cardId);
    } else {
      // Soft delete
      try {
        await deleteCard(cardId);
        
        // If trash view is enabled, reload data to show the deleted card
        // Otherwise, remove from current view
        if (showDeleted && (isAdmin || isEditor)) {
          await loadData();
        } else {
          const updatedCards = cards.filter(c => c.id !== cardId);
          setCards(updatedCards);
          
          const updatedFiltered = filteredCards.filter(c => c.id !== cardId);
          setFilteredCards(updatedFiltered);
        }
      } catch (error) {
        console.error('Error deleting card:', error);
        alert('Failed to delete card. Please try again.');
      }
    }
  };

  // Handle card creation
  const handleCardCreated = async () => {
    await loadData();
  };

  // Handle card update
  const handleCardUpdated = async () => {
    await loadData();
  };

  // Load more function for pagination
  const loadMore = async (page: number) => {
    try {
      const response = await fetchCards(page, {
        type: selectedTypes,
        tags: selectedTags,
        search: searchTerm,
        includeDeleted: showDeleted && (isAdmin || isEditor)
      });
      return processCardsWithDeletedStatus(response.cards);
    } catch (error) {
      console.error('Error loading more cards:', error);
      return [];
    }
  };

  return {
    // State
    selectedTypes,
    selectedTags,
    currentSort,
    searchTerm,
    filteredCards,
    cards,
    availableTags,
    loading,
    lastEditedCardId,
    totalCardCount,
    showDeleted,

    // Handlers
    handleFilterChange,
    handleSearch,
    handleSortChange,
    handleEditCard,
    handleDeleteCard,
    handleCardCreated,
    handleCardUpdated,
    loadMore,
    setShowDeleted,
    setLastEditedCardId,

    // Setters for external control
    setSelectedTypes,
    setSelectedTags,
    setCurrentSort,
    setSearchTerm,
  };
}