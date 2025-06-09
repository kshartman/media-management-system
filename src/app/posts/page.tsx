'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import CardFactory from '../../components/cards/CardFactory';
import TagDropdown from '../../components/filters/TagDropdown';
import SortDropdown, { SortOption } from '../../components/filters/SortDropdown';
import SearchField from '../../components/filters/SearchField';
import LoginForm from '../../components/auth/LoginForm';
import AdminBar from '../../components/admin/AdminBar';
import CardUploadModal from '../../components/admin/CardUploadModal';
import CardGrid from '../../components/layout/CardGrid';
import Navigation from '../../components/layout/Navigation';
import { CardProps, SocialCardProps } from '../../types';
import { useAuth } from '../../lib/authContext';
import { fetchCards, deleteCard, updateCard, getAllTags, fetchCardById } from '../../lib/api';

export default function PostsPage() {
  const { isAdmin, login, logout } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentEditCard, setCurrentEditCard] = useState<CardProps | undefined>(undefined);
  const selectedTypes = ['social']; // Fixed to social type
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [currentSort, setCurrentSort] = useState<SortOption>('newest');
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredCards, setFilteredCards] = useState<CardProps[]>([]);
  const [cards, setCards] = useState<CardProps[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastEditedCardId, setLastEditedCardId] = useState<string | null>(null);
  const [totalCardCount, setTotalCardCount] = useState<number>(0);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Event handler for image drop on social cards
  useEffect(() => {
    const handleImageDrop = (event: CustomEvent) => {
      const { cardId, files } = event.detail;
      if (!cardId || !files || !files.length) return;
      
      const cardToEdit = cards.find(card => card.id === cardId);
      if (!cardToEdit) return;
      
      setLastEditedCardId(cardId);
      setCurrentEditCard({...cardToEdit});
      
      if (cardToEdit.type === 'social') {
        window.droppedFiles = files;
      }
      
      setShowEditModal(true);
    };

    document.addEventListener('socialcard:imagedrop', handleImageDrop as EventListener);
    
    return () => {
      document.removeEventListener('socialcard:imagedrop', handleImageDrop as EventListener);
    };
  }, [cards]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // Load social cards and tags - only fetch social type
        const [cardsResponse, tagsResponse] = await Promise.all([
          fetchCards(1, { type: selectedTypes, tags: [], search: '' }, 100),
          getAllTags()
        ]);
        
        setTotalCardCount(cardsResponse.totalCount);
        setCards(cardsResponse.cards);
        setAvailableTags(tagsResponse);

        // Apply sorting to social cards
        const sorted = applyFiltersAndSort(
          cardsResponse.cards,
          selectedTypes,
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
                type: selectedTypes, 
                tags: [], 
                search: '' 
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
                selectedTypes,
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

    // Filter by type (always social for this page)
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

          // Search in file names (social-specific files)
          const files = [card.preview];
          if (card.type === 'social') {
            const socialCard = card as SocialCardProps;
            if (socialCard.imageSequence && socialCard.imageSequence.length > 0) {
              files.push(...socialCard.imageSequence);
            }
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
      
      // Fetch filtered social cards from server
      const response = await fetchCards(1, {
        type: ['social'],
        tags: tags,
        search: searchTerm
      });
      
      setCards(response.cards);
      setTotalCardCount(response.totalCount);
      
      const sorted = applyFiltersAndSort(response.cards, ['social'], tags, currentSort, '');
      setFilteredCards(sorted);
      
      // Pre-load more cards if needed
      if (response.cards.length < response.totalCount && response.totalCount > 0) {
        setTimeout(async () => {
          try {
            const page2Response = await fetchCards(2, {
              type: ['social'],
              tags: tags,
              search: searchTerm
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
              ['social'],
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
    const filteredAndSorted = applyFiltersAndSort(cards, ['social'], selectedTags, sortOption, searchTerm);
    setFilteredCards(filteredAndSorted);
  };

  const handleSearch = async (search: string) => {
    setLoading(true);
    try {
      setSearchTerm(search);

      const response = await fetchCards(1, {
        type: ['social'],
        tags: selectedTags,
        search: search
      });
      
      setCards(response.cards);
      setTotalCardCount(response.totalCount);
      
      const sorted = applyFiltersAndSort(response.cards, ['social'], selectedTags, currentSort, '');
      setFilteredCards(sorted);
      
      if (response.cards.length < response.totalCount) {
        setTimeout(async () => {
          try {
            const page2Response = await fetchCards(2, {
              type: ['social'],
              tags: selectedTags,
              search: search
            });
            
            const combinedCards = [...response.cards, ...page2Response.cards];
            const newSorted = applyFiltersAndSort(combinedCards, ['social'], selectedTags, currentSort, '');
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
    if (isAdmin) {
      logout();
    } else {
      setShowLoginModal(true);
    }
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
        ['social'],
        selectedTags,
        currentSort,
        searchTerm
      );
      setFilteredCards(updatedFilteredCards);
      
      try {
        await deleteCard(id);
      } catch (apiError) {
        setCards(cards);
        const revertedFilteredCards = applyFiltersAndSort(
          cards,
          ['social'],
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
        fetchCards(1, { type: ['social'], tags: selectedTags, search: searchTerm }),
        getAllTags()
      ]);

      setCards(cardsResponse.cards);
      setAvailableTags(tagsResponse);

      const filteredAndSorted = applyFiltersAndSort(
        cardsResponse.cards,
        ['social'],
        selectedTags,
        currentSort,
        searchTerm
      );
      setFilteredCards(filteredAndSorted);
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  };

  const handleCardUpdated = async (formData: FormData) => {
    try {
      if (!currentEditCard) return;

      await updateCard(currentEditCard.id, formData);
      setShowEditModal(false);

      const [cardsResponse, tagsResponse] = await Promise.all([
        fetchCards(1, { 
          type: ['social'], 
          tags: selectedTags, 
          search: searchTerm 
        }, 100),
        getAllTags()
      ]);
      
      setTotalCardCount(cardsResponse.totalCount);
      setCards(cardsResponse.cards);
      setAvailableTags(tagsResponse);

      const filteredAndSorted = applyFiltersAndSort(
        cardsResponse.cards,
        ['social'],
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#d9f2fc] border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3">
          {/* Top row with title, logo, and menu */}
          <div className="flex justify-between items-center relative">
            <div className="relative">
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="flex items-center justify-center w-10 h-10 text-gray-700 hover:text-gray-900 focus:outline-none"
                aria-label="Menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              
              {showMobileMenu && (
                <div className="absolute left-0 top-12 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                  <button
                    onClick={() => {
                      handleLoginClick();
                      setShowMobileMenu(false);
                    }}
                    className="block w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 text-left"
                  >
                    {isAdmin ? 'Logout' : 'Admin Login'}
                  </button>
                  <a
                    href="https://affiliates.shopzive.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setShowMobileMenu(false)}
                  >
                    Affiliate Portal
                  </a>
                  <a
                    href="https://shopzive.com/pages/zivepro-affiliate-resources"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setShowMobileMenu(false)}
                  >
                    Affiliate Training
                  </a>
                </div>
              )}
            </div>

            <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center">
              <Image
                src="/zive-logo.png"
                alt="ZIVE logo"
                className="h-8 w-auto"
                width={96}
                height={32}
                priority
              />
            </div>

            <h1 className="text-xl font-bold text-gray-900 hidden sm:block">Social Post Resources</h1>
          </div>
          
          {/* Navigation row */}
          <div className="mt-3 flex justify-center">
            <Navigation />
          </div>
        </div>
      </header>

      <div className="sticky top-[100px] z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center gap-4">
            {isAdmin && (
              <div className="mr-2">
                <AdminBar
                  onCardCreated={handleCardCreated}
                  availableTags={availableTags}
                  selectedCardType="social"
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
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 pt-6">
        {!loading && totalCardCount > 0 && (
          <div className="mb-4 text-gray-600 text-sm">
            Showing {filteredCards.length} of {totalCardCount} social post cards
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
                  type: ['social'],
                  tags: selectedTags,
                  search: searchTerm
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
            selectedTypes={selectedTypes}
            lastEditedCardId={lastEditedCardId}
          />
        )}
      </main>

      {showLoginModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
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