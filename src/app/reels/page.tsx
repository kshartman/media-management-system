'use client';

import React, { useState, useEffect } from 'react';
import TagDropdown from '../../components/filters/TagDropdown';
import SortDropdown, { SortOption } from '../../components/filters/SortDropdown';
import SearchField from '../../components/filters/SearchField';
import LoginForm from '../../components/auth/LoginForm';
import AdminBar from '../../components/admin/AdminBar';
import CardUploadModal from '../../components/admin/CardUploadModal';
import CardGrid from '../../components/layout/CardGrid';
import AppHeader from '../../components/layout/AppHeader';
import { CardProps, ReelCardProps } from '../../types';
import { useAuth } from '../../lib/authContext';
import { fetchCards, deleteCard, updateCard, getAllTags, fetchCardById } from '../../lib/api';

export default function ReelsPage() {
  const { isAdmin } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentEditCard, setCurrentEditCard] = useState<CardProps | undefined>(undefined);
  const selectedTypes = ['reel']; // Fixed to reel type
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [currentSort, setCurrentSort] = useState<SortOption>('newest');
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredCards, setFilteredCards] = useState<CardProps[]>([]);
  const [cards, setCards] = useState<CardProps[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastEditedCardId, setLastEditedCardId] = useState<string | null>(null);
  const [totalCardCount, setTotalCardCount] = useState<number>(0);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // Load reel cards and tags - only fetch reel type
        const [cardsResponse, tagsResponse] = await Promise.all([
          fetchCards(1, { type: ['reel'], tags: [], search: '', sort: currentSort }, 100),
          getAllTags()
        ]);
        
        setTotalCardCount(cardsResponse.totalCount);
        setCards(cardsResponse.cards);
        setAvailableTags(tagsResponse);

        // Apply sorting to reel cards
        const sorted = applyFiltersAndSort(
          cardsResponse.cards,
          ['reel'],
          [],
          'newest',
          ''
        );
        setFilteredCards(sorted);
        
        // Pre-load more cards if needed
        if (cardsResponse.cards.length < cardsResponse.totalCount) {
          setTimeout(async () => {
            try {
              const page2Response = await fetchCards(2, { 
                type: ['reel'], 
                tags: [], 
                search: '',
                sort: currentSort 
              });
              
              const combinedCards = [...cardsResponse.cards];
              page2Response.cards.forEach(newCard => {
                if (!combinedCards.some(existingCard => existingCard.id === newCard.id)) {
                  combinedCards.push(newCard);
                }
              });
              
              setCards(combinedCards);
              
              const combinedSorted = applyFiltersAndSort(
                combinedCards,
                ['reel'],
                [],
                'newest',
                ''
              );
              setFilteredCards(combinedSorted);
            } catch (error) {
              console.error('Error pre-loading page 2:', error);
            }
          }, 100);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);
  
  // Apply all filters and sorting
  const applyFiltersAndSort = (
    allCards: CardProps[],
    types: string[],
    tags: string[],
    sort: SortOption,
    search: string = ''
  ) => {
    let filtered = [...allCards];

    // Filter by type (always reel for this page)
    if (types.length > 0) {
      filtered = filtered.filter(card => 
        types.some(t => t.toLowerCase() === card.type?.toLowerCase())
      );
    }

    // Filter by tags if any tags are selected
    if (tags.length > 0) {
      filtered = filtered.filter(card =>
        card.tags.some(tag => tags.includes(tag))
      );
    }

    // Filter by search term if provided
    if (search.trim() !== '') {
      const searchLower = search.toLowerCase();
      const searchTerms = searchLower.split(/\s+/).filter(term => term.length > 0);

      filtered = filtered.filter(card => {
        return searchTerms.every(term => {
          const descLower = card.description.toLowerCase();
          const words = descLower.split(/\s+/);
          if (words.some(word => word === term || word.startsWith(term))) return true;
          if (card.tags.some(tag => tag.toLowerCase() === term)) return true;

          // Search in file names (reel-specific files)
          const files = [card.preview];
          if (card.type === 'reel') {
            const reelCard = card as ReelCardProps;
            files.push(reelCard.movie);
            files.push(reelCard.transcript);
          }

          return files.some(file => {
            if (!file) return false;
            const filename = file.split('/').pop()?.toLowerCase() || '';
            const filenameWords = filename.split(/[.\-_\s]/).filter(Boolean);
            return filenameWords.some(word => word === term || word.startsWith(term));
          });
        });
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const dateA = a.fileMetadata?.date ? new Date(a.fileMetadata.date).getTime() : 0;
      const dateB = b.fileMetadata?.date ? new Date(b.fileMetadata.date).getTime() : 0;
      return sort === 'newest' ? dateB - dateA : dateA - dateB;
    });

    return filtered;
  };

  const handleFilterChange = async (filters: { tags?: string[] }) => {
    setLoading(true);
    
    try {
      if (filters.tags !== undefined) {
        setSelectedTags(filters.tags);
      }

      const tags = filters.tags !== undefined ? filters.tags : selectedTags;
      
      // Fetch filtered reel cards from server
      const response = await fetchCards(1, {
        type: ['reel'],
        tags: tags,
        search: searchTerm,
        sort: currentSort
      });
      
      setCards(response.cards);
      setTotalCardCount(response.totalCount);
      
      const sorted = applyFiltersAndSort(response.cards, ['reel'], tags, currentSort, '');
      setFilteredCards(sorted);
      
      // Pre-load more cards if needed
      if (response.cards.length < response.totalCount && response.totalCount > 0) {
        setTimeout(async () => {
          try {
            const page2Response = await fetchCards(2, {
              type: ['reel'],
              tags: tags,
              search: searchTerm,
              sort: currentSort
            });
            
            const combinedCards = [...response.cards];
            page2Response.cards.forEach(newCard => {
              if (!combinedCards.some(existingCard => existingCard.id === newCard.id)) {
                combinedCards.push(newCard);
              }
            });
            
            setCards(combinedCards);
            const combinedFiltered = applyFiltersAndSort(
              combinedCards,
              ['reel'],
              tags,
              currentSort,
              ''
            );
            setFilteredCards(combinedFiltered);
          } catch (error) {
            console.error('Error pre-loading page 2:', error);
          }
        }, 100);
      }
    } catch (error) {
      console.error('Error applying filters:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSortChange = (sortOption: SortOption) => {
    setCurrentSort(sortOption);
    const filteredAndSorted = applyFiltersAndSort(cards, ['reel'], selectedTags, sortOption, searchTerm);
    setFilteredCards(filteredAndSorted);
  };

  const handleSearch = async (search: string) => {
    setLoading(true);
    try {
      setSearchTerm(search);

      const response = await fetchCards(1, {
        type: ['reel'],
        tags: selectedTags,
        search: search,
        sort: currentSort
      });
      
      setCards(response.cards);
      setTotalCardCount(response.totalCount);
      
      const sorted = applyFiltersAndSort(response.cards, ['reel'], selectedTags, currentSort, '');
      setFilteredCards(sorted);
      
      if (response.cards.length < response.totalCount) {
        setTimeout(async () => {
          try {
            const page2Response = await fetchCards(2, {
              type: ['reel'],
              tags: selectedTags,
              search: search,
              sort: currentSort
            });
            
            const combinedCards = [...response.cards, ...page2Response.cards];
            const newSorted = applyFiltersAndSort(combinedCards, ['reel'], selectedTags, currentSort, '');
            setCards(combinedCards);
            setFilteredCards(newSorted);
          } catch (error) {
            console.error('Error pre-loading page 2:', error);
          }
        }, 100);
      }
    } catch (error) {
      console.error('Error searching cards:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleLoginClick = () => {
    setShowLoginModal(true);
  };

  const handleLoginSuccess = () => {
    setShowLoginModal(false);
  };

  const handleEditCard = (id: string) => {
    const cardToEdit = cards.find(card => card.id === id);
    
    if (cardToEdit) {
      setLastEditedCardId(id);
      setCurrentEditCard({...cardToEdit});
      setShowEditModal(true);
    } else {
      setTimeout(async () => {
        try {
          const fetchedCard = await fetchCardById(id);
          setLastEditedCardId(id);
          setCurrentEditCard(fetchedCard);
          setShowEditModal(true);
        } catch (error) {
          console.error(`Error fetching card ${id}:`, error);
          alert('Error loading card data. Please try refreshing the page.');
        }
      }, 10);
    }
  };

  const handleDeleteCard = async (id: string) => {
    try {
      const updatedCards = cards.filter(card => card.id !== id);
      setCards(updatedCards);
      
      const updatedFilteredCards = applyFiltersAndSort(
        updatedCards,
        ['reel'],
        selectedTags,
        currentSort,
        searchTerm
      );
      setFilteredCards(updatedFilteredCards);
      
      try {
        await deleteCard(id);
      } catch {
        setCards(cards);
        const revertedFilteredCards = applyFiltersAndSort(
          cards,
          ['reel'],
          selectedTags,
          currentSort,
          searchTerm
        );
        setFilteredCards(revertedFilteredCards);
        alert('Failed to delete card. Please try again.');
      }
    } catch (error) {
      console.error('Error in delete handler:', error);
      alert('An error occurred while trying to delete the card.');
    }
  };

  const handleCardCreated = async () => {
    try {
      const [cardsResponse, tagsResponse] = await Promise.all([
        fetchCards(1, { type: ['reel'], tags: selectedTags, search: searchTerm, sort: currentSort }),
        getAllTags()
      ]);

      setCards(cardsResponse.cards);
      setAvailableTags(tagsResponse);

      const filteredAndSorted = applyFiltersAndSort(
        cardsResponse.cards,
        ['reel'],
        selectedTags,
        currentSort,
        searchTerm
      );
      setFilteredCards(filteredAndSorted);
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  };

  // Refresh all cards (for reel updates)
  const handleRefreshCards = async () => {
    try {
      const [cardsResponse, tagsResponse] = await Promise.all([
        fetchCards(1, { type: ['reel'], tags: selectedTags, search: searchTerm, sort: currentSort }),
        getAllTags()
      ]);

      setTotalCardCount(cardsResponse.totalCount);
      setCards(cardsResponse.cards);
      setAvailableTags(tagsResponse);

      const filteredAndSorted = applyFiltersAndSort(
        cardsResponse.cards,
        ['reel'],
        selectedTags,
        currentSort,
        searchTerm
      );
      setFilteredCards(filteredAndSorted);
    } catch (error) {
      console.error('Error refreshing cards:', error);
    }
  };

  const handleCardUpdated = async (formData: FormData) => {
    try {
      if (!currentEditCard) return;

      await updateCard(currentEditCard.id, formData);
      setShowEditModal(false);

      const [cardsResponse, tagsResponse] = await Promise.all([
        fetchCards(1, { 
          type: ['reel'], 
          tags: selectedTags, 
          search: searchTerm,
          sort: currentSort 
        }, 100),
        getAllTags()
      ]);
      
      setTotalCardCount(cardsResponse.totalCount);
      setCards(cardsResponse.cards);
      setAvailableTags(tagsResponse);

      const filteredAndSorted = applyFiltersAndSort(
        cardsResponse.cards,
        ['reel'],
        selectedTags,
        currentSort,
        searchTerm
      );
      setFilteredCards(filteredAndSorted);
    } catch (error) {
      console.error('Error updating card:', error);
      alert('Failed to update card. Please try again.');
    }
  };

  // Body scroll locking effect for login modal
  useEffect(() => {
    if (!showLoginModal) return;

    // Store the original styles and scroll position
    const originalStyle = window.getComputedStyle(document.body).overflow;
    const scrollY = window.scrollY;
    
    // Store the scroll position value in local state for this component instance
    const scrollPosForThisModal = scrollY;
    
    // Lock body scroll and fix position
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.top = `-${scrollY}px`;
    document.documentElement.style.overflow = 'hidden';

    return () => {
      // Restore original style when component unmounts
      document.body.style.overflow = originalStyle;
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      document.documentElement.style.overflow = '';
      
      // Restore scroll position
      window.scrollTo(0, scrollPosForThisModal);
    };
  }, [showLoginModal]);

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader 
        title="Reel Resources"
        showControls={true}
        onLoginClick={handleLoginClick}
        controlsSlot={
          <>
            <div className="flex items-center gap-4">
              {isAdmin && (
                <div className="mr-2">
                  <AdminBar
                    onCardCreated={handleCardCreated}
                    availableTags={availableTags}
                    selectedCardType="reel"
                  />
                </div>
              )}
              <TagDropdown
                onFilterChange={handleFilterChange}
                selectedTags={selectedTags}
                availableTags={availableTags}
              />
              <SortDropdown
                onSortChange={handleSortChange}
                currentSort={currentSort}
              />
              <div className="ml-auto">
                <SearchField
                  onSearch={handleSearch}
                  initialSearchTerm={searchTerm}
                />
              </div>
            </div>

            {selectedTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2 ml-0 items-center">
                <button
                  onClick={() => handleFilterChange({ tags: [] })}
                  className="flex items-center justify-center text-red-600 hover:text-red-800 mr-1 focus:outline-none"
                  title="Clear all tag filters"
                >
                  <span className="font-bold text-xl">×</span>
                </button>
                <span className="font-semibold text-sm text-gray-700 mr-1">Filter Tags:</span>
                {selectedTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800 font-medium"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => {
                        const newTags = selectedTags.filter(t => t !== tag);
                        handleFilterChange({ tags: newTags });
                      }}
                      className="ml-1.5 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </>
        }
      />

      <main className="max-w-7xl mx-auto px-4 pt-6">
        {!loading && totalCardCount > 0 && (
          <div className="mb-4 text-gray-600 text-sm">
            Showing {filteredCards.length} of {totalCardCount} reel cards
          </div>
        )}
        
        {loading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <CardGrid
            initialCards={filteredCards}
            loadMore={async (page) => {
              try {
                const response = await fetchCards(page, {
                  type: ['reel'],
                  tags: selectedTags,
                  search: searchTerm,
                  sort: currentSort
                });
                return response.cards;
              } catch (error) {
                console.error('Error loading more cards:', error);
                return [];
              }
            }}
            isAdmin={isAdmin}
            onEdit={isAdmin ? handleEditCard : undefined}
            onDelete={isAdmin ? handleDeleteCard : undefined}
            onRefresh={handleRefreshCards}
            selectedTypes={selectedTypes}
            lastEditedCardId={lastEditedCardId}
          />
        )}
      </main>

      {showLoginModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-auto">
          <div className="bg-white rounded-lg shadow-xl absolute left-1/2 transform -translate-x-1/2 w-full max-w-md px-4" style={{ top: '120px' }}>
            <div className="relative">
              <button
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
                onClick={() => setShowLoginModal(false)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <LoginForm onLoginSuccess={handleLoginSuccess} />
            </div>
          </div>
        </div>
      )}

      {showEditModal && currentEditCard && (
        <CardUploadModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setLastEditedCardId(null);
          }}
          onSubmit={handleCardUpdated}
          initialData={currentEditCard}
          availableTags={availableTags}
        />
      )}
    </div>
  );
}