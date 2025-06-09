'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import TypeDropdown from '../components/filters/TypeDropdown';
import TagDropdown from '../components/filters/TagDropdown';
import SortDropdown, { SortOption } from '../components/filters/SortDropdown';
import SearchField from '../components/filters/SearchField';
import LoginForm from '../components/auth/LoginForm';
import AdminBar from '../components/admin/AdminBar';
import CardUploadModal from '../components/admin/CardUploadModal';
import CardGrid from '../components/layout/CardGrid';
import Navigation from '../components/layout/Navigation';
import { CardProps, ImageCardProps, SocialCardProps, ReelCardProps } from '../types';
import { useAuth } from '../lib/authContext';
import { fetchCards, fetchCardById, deleteCard, updateCard, getAllTags } from '../lib/api';

// Sample cards for testing (fallback if API fails)
const SampleCards: CardProps[] = [
  {
    id: '1',
    type: 'image',
    preview: 'https://placehold.co/600x400/3498db/FFFFFF/png?text=Mountain+Landscape',
    download: 'https://placehold.co/600x400/3498db/FFFFFF/png?text=Mountain+Landscape',
    tags: ['nature', 'landscape'],
    description: 'Beautiful mountain landscape at sunset',
  },
  {
    id: '2',
    type: 'social',
    preview: 'https://placehold.co/600x400/e74c3c/FFFFFF/png?text=Social+Media',
    imageSequence: ['https://placehold.co/600x400/e74c3c/FFFFFF/png?text=Social+Media'],
    instagramCopy: '<p>Example Instagram copy</p>',
    facebookCopy: '<p>Example Facebook copy</p>',
    tags: ['marketing', 'social media'],
    description: 'Social media post template for summer campaign',
  },
  {
    id: '3',
    type: 'reel',
    preview: 'https://placehold.co/600x400/f39c12/FFFFFF/png?text=Video+Testimonial',
    movie: 'https://example.com/video.mp4',
    transcript: 'https://example.com/transcript.txt',
    instagramCopy: '<p>Example Instagram copy for reel</p>',
    facebookCopy: '<p>Example Facebook copy for reel</p>',
    tags: ['video', 'testimonial'],
    description: 'Customer testimonial about our services',
  },
  {
    id: '4',
    type: 'image',
    preview: 'https://placehold.co/600x400/27ae60/FFFFFF/png?text=Product+Photo',
    download: 'https://placehold.co/600x400/27ae60/FFFFFF/png?text=Product+Photo',
    tags: ['product', 'photography'],
    description: 'Product photography for the new collection',
  }
];

export default function Home() {
  const { isAdmin, logout } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentEditCard, setCurrentEditCard] = useState<CardProps | undefined>(undefined);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
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
  
  // Fetch cards and tags from the API when the component mounts
  // Event handler for image drop on social cards
  useEffect(() => {
    const handleImageDrop = (event: CustomEvent) => {
      const { cardId, files } = event.detail;
      if (!cardId || !files || !files.length) return;
      
      // Find the card to edit
      const cardToEdit = cards.find(card => card.id === cardId);
      if (!cardToEdit) return;
      
      // Just save the ID of the card being edited
      setLastEditedCardId(cardId);
      
      // Set as current edit card and open modal
      setCurrentEditCard({...cardToEdit});
      
      // Prepare files based on card type
      if (cardToEdit.type === 'social') {
        // For social cards, files go into the image sequence
        window.droppedFiles = files;
      } else if (cardToEdit.type === 'image') {
        // For image cards, create a FormData object with the new preview/download
        const formData = new FormData();
        
        // Add file as preview (the CardForm will handle it appropriately as either preview or download)
        formData.append('preview', files[0]);
        
        // Store the FormData object for the CardUploadModal to use
        window.imageCardFormData = formData;
      }
      
      // Open edit modal
      setShowEditModal(true);
    };

    // Add event listeners for both social and image card drops
    document.addEventListener('socialcard:imagedrop', handleImageDrop as EventListener);
    document.addEventListener('imagecard:imagedrop', handleImageDrop as EventListener);
    
    // Remove event listeners on cleanup
    return () => {
      document.removeEventListener('socialcard:imagedrop', handleImageDrop as EventListener);
      document.removeEventListener('imagecard:imagedrop', handleImageDrop as EventListener);
    };
  }, [cards]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // Load cards and tags concurrently - fetch all cards with a large limit
        const [cardsResponse, tagsResponse] = await Promise.all([
          fetchCards(1, { type: [], tags: [], search: '' }, 100), // Use a large limit to try to get all cards at once
          getAllTags()
        ]);
        
        
        // Save the total count for display
        setTotalCardCount(cardsResponse.totalCount);
        setCards(cardsResponse.cards);
        setAvailableTags(tagsResponse);

        // Filter to show all card types by default and apply sorting
        const initialFiltered = applyFiltersAndSort(
          cardsResponse.cards,
          [],         // Empty array means all types (no type filter)
          [],         // No tags selected by default
          'newest',   // Default sort to newest
          ''          // No search term
        );
        setFilteredCards(initialFiltered);
        
        // Pre-load more cards immediately if we don't have all of them
        if (cardsResponse.cards.length < cardsResponse.totalCount) {
          setTimeout(async () => {
            try {
              // Fetch page 2 immediately
              const page2Response = await fetchCards(2, { 
                type: [], 
                tags: [], 
                search: '' 
              });
              
              // Combine page 1 and page 2, removing duplicates by ID
              const combinedCards = [...cardsResponse.cards];
              
              // Add cards from page 2 that don't already exist in page 1
              page2Response.cards.forEach(newCard => {
                if (!combinedCards.some(existingCard => existingCard.id === newCard.id)) {
                  combinedCards.push(newCard);
                }
              });
              
              setCards(combinedCards);
              
              // Re-filter with combined cards
              const combinedFiltered = applyFiltersAndSort(
                combinedCards,
                [],     // Empty array means all types (no type filter)
                [],     // No tags selected by default
                'newest', // Default sort to newest
                ''      // No search term
              );
              setFilteredCards(combinedFiltered);
              
            } catch (error) {
              console.error('Error pre-loading page 2:', error);
            }
          }, 100);
        }
      } catch (error) {
        console.error('Error loading data:', error);
        // Fallback to sample cards if API fails
        setCards(SampleCards);
        // Filter to show all card types by default and apply sorting
        const initialFiltered = applyFiltersAndSort(
          SampleCards,
          [],         // Empty array means all types (no type filter)
          [],         // No tags selected by default
          'newest',   // Default sort to newest
          ''          // No search term
        );
        setFilteredCards(initialFiltered);
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
    
    // Apply filters
    let filtered = [...allCards];

    // Filter by type if any types are selected
    if (types.length > 0) {
      filtered = filtered.filter(card => {
        // Add a case-insensitive match for better compatibility
        const cardType = card.type?.toLowerCase();
        const typeMatches = types.some(t => t.toLowerCase() === cardType);
        return typeMatches;
      });
    }

    // Filter by tags if any tags are selected
    if (tags.length > 0) {
      filtered = filtered.filter(card =>
        // Card must have at least one of the selected tags
        card.tags.some(tag => tags.includes(tag))
      );
    }

    // Filter by search term if provided
    if (search.trim() !== '') {
      const searchLower = search.toLowerCase();
      const searchTerms = searchLower.split(/\s+/).filter(term => term.length > 0);

      filtered = filtered.filter(card => {
        // For each search term, check if it matches as a word or word start
        return searchTerms.every(term => {
          const descLower = card.description.toLowerCase();

          // Split description into words and check for exact matches or prefixes
          const words = descLower.split(/\s+/);
          if (words.some(word => word === term || word.startsWith(term))) return true;

          // Also check if the term appears in the tags (exact match only)
          if (card.tags.some(tag => tag.toLowerCase() === term)) return true;

          // Search in file names (extract file names from paths)
          const files: (string | undefined | null)[] = [
            card.preview
          ];

          // Add type-specific files based on card type
          if (card.type === 'image') {
            files.push((card as unknown as ImageCardProps).download);
          } else if (card.type === 'social') {
            // For social cards, add all the images in the sequence
            const socialCard = (card as unknown as SocialCardProps);
            if (socialCard.imageSequence && socialCard.imageSequence.length > 0) {
              files.push(...socialCard.imageSequence);
            }
          } else if (card.type === 'reel') {
            files.push((card as unknown as ReelCardProps).movie);
            files.push((card as unknown as ReelCardProps).transcript);
          }

          // Filter out null/undefined values
          const validFiles = files.filter(Boolean);

          return validFiles.some(file => {
            if (!file) return false;
            // Extract filename from path
            const fullFilename = file.split('/').pop()?.toLowerCase() || '';

            // Split filename by common separators and extract words
            const filenameWords = fullFilename
              .split(/[.\-_\s]/) // Split by dots, hyphens, underscores, spaces
              .filter(Boolean);  // Remove empty strings

            // Look for exact word matches or prefixes in filename parts
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

  const handleFilterChange = async (filters: { type?: string[], tags?: string[] }) => {
    setLoading(true);
    
    try {
      // Update selected types if provided
      if (filters.type !== undefined) {
        setSelectedTypes(filters.type);
      }

      // Update selected tags if provided
      if (filters.tags !== undefined) {
        setSelectedTags(filters.tags);
      }

      // Get current filter states (using the updated values)
      const types = filters.type !== undefined ? filters.type : selectedTypes;
      const tags = filters.tags !== undefined ? filters.tags : selectedTags;
      
      
      // Fetch filtered cards directly from the server for type filters - first page only
      if (filters.type !== undefined) {
        const response = await fetchCards(1, {
          type: types,
          tags: tags,
          search: searchTerm
        });
        
        // Update all cards, available tags, and total count
        setCards(response.cards);
        setTotalCardCount(response.totalCount);
        
        // Apply client-side sort only - we already have server-side filtered cards
        // Preserve the type filter from the server, but apply client-side sorting
        const sorted = applyFiltersAndSort(response.cards, types, tags, currentSort, '');
        setFilteredCards(sorted);
        
        // Pre-load more cards immediately if we don't have all of them
        if (response.cards.length < response.totalCount && response.totalCount > 0) {
          setTimeout(async () => {
            try {
              // Fetch page 2 immediately with the same type filters
              const page2Response = await fetchCards(2, {
                type: types,
                tags: tags,
                search: searchTerm
              });
              
              // Combine page 1 and page 2, removing duplicates by ID
              const combinedCards = [...response.cards];
              
              // Add cards from page 2 that don't already exist in page 1
              page2Response.cards.forEach(newCard => {
                if (!combinedCards.some(existingCard => existingCard.id === newCard.id)) {
                  combinedCards.push(newCard);
                }
              });
              
              setCards(combinedCards);
              
              // Re-filter with combined cards
              const combinedFiltered = applyFiltersAndSort(
                combinedCards,
                types,
                tags,
                currentSort,
                ''
              );
              setFilteredCards(combinedFiltered);
              
            } catch (error) {
              console.error('Error pre-loading page 2 for type filter:', error);
            }
          }, 100);
        }
      } else {
        // For other filters, use client-side filtering
        
        // Apply filters and sort
        const filteredAndSorted = applyFiltersAndSort(cards, types, tags, currentSort, searchTerm);
        setFilteredCards(filteredAndSorted);
        
        // If we have very few cards after filtering, we might need to load more from the server
        if (filteredAndSorted.length < 5 && totalCardCount > filteredAndSorted.length) {
          
          // Load more cards from server then re-filter
          setTimeout(async () => {
            try {
              // Re-fetch with server-side filtering for more accurate results
              const response = await fetchCards(1, {
                type: types,
                tags: tags,
                search: searchTerm
              }, 24); // Double the page size for this specific case
              
              // Make sure we don't have duplicates in the response
              const uniqueCards: typeof response.cards = [];
              response.cards.forEach(card => {
                if (!uniqueCards.some(existingCard => existingCard.id === card.id)) {
                  uniqueCards.push(card);
                }
              });
              
              setCards(uniqueCards);
              
              // Re-apply client side filtering
              const newFilteredAndSorted = applyFiltersAndSort(
                uniqueCards,
                types,
                tags,
                currentSort,
                searchTerm
              );
              
              setFilteredCards(newFilteredAndSorted);
              setTotalCardCount(response.totalCount);
            } catch (error) {
              console.error('Error loading more cards for client-side filtering:', error);
            }
          }, 100);
        }
      }
    } catch (error) {
      console.error('Error applying filters:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle sorting change
  const handleSortChange = (sortOption: SortOption) => {
    setCurrentSort(sortOption);

    // Re-apply current filters with new sort option
    const filteredAndSorted = applyFiltersAndSort(cards, selectedTypes, selectedTags, sortOption, searchTerm);
    setFilteredCards(filteredAndSorted);
  };

  // Handle search changes
  const handleSearch = async (search: string) => {
    setLoading(true);
    try {
      setSearchTerm(search);

      // Fetch results from server with all current filters - first page only
      const response = await fetchCards(1, {
        type: selectedTypes,
        tags: selectedTags,
        search: search
      });
      
      // Update cards with search results and total count
      setCards(response.cards);
      setTotalCardCount(response.totalCount);
      
      // Apply client-side sorting while preserving server-side filtering
      const sorted = applyFiltersAndSort(response.cards, selectedTypes, selectedTags, currentSort, '');
      setFilteredCards(sorted);
      
      // If we have fewer cards than the total, try to load more immediately
      if (response.cards.length < response.totalCount) {
        setTimeout(async () => {
          try {
            const page2Response = await fetchCards(2, {
              type: selectedTypes,
              tags: selectedTags,
              search: search
            });
            
            // Combine both pages and apply filters/sort
            const combinedCards = [...response.cards, ...page2Response.cards];
            const newSorted = applyFiltersAndSort(combinedCards, selectedTypes, selectedTags, currentSort, '');
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
    
    // First check if the card exists in our current state
    const cardToEdit = cards.find(card => card.id === id);
    
    if (cardToEdit) {
      // Save the ID of the card being edited
      setLastEditedCardId(id);
      
      // Re-create the card object to ensure React detects the change
      const cardCopy = {...cardToEdit};
      setCurrentEditCard(cardCopy);
      setShowEditModal(true);
    } else {
      // If we can't find the card, try to fetch it directly
      
      // Add a small delay to let any UI updates complete first
      setTimeout(async () => {
        try {
          const fetchedCard = await fetchCardById(id);
          
          setLastEditedCardId(id);
          setCurrentEditCard(fetchedCard);
          setShowEditModal(true);
        } catch (error) {
          console.error(`Error fetching individual card with ID ${id}:`, error);
          alert('Error loading card data. Please try refreshing the page.');
        }
      }, 10);
    }
  };

  const handleDeleteCard = async (id: string) => {
    try {
      const cardToDelete = cards.find(card => card.id === id);
      if (!cardToDelete) {
        throw new Error('Card not found');
      }
      
      // First update the UI - optimistic update
      const updatedCards = cards.filter(card => card.id !== id);
      setCards(updatedCards);
      
      // Apply filters to the updated list
      const updatedFilteredCards = applyFiltersAndSort(
        updatedCards,
        selectedTypes,
        selectedTags,
        currentSort,
        searchTerm
      );
      setFilteredCards(updatedFilteredCards);
      
      // Then attempt the actual deletion
      try {
        await deleteCard(id);
      } catch (apiError) {
        console.error('Error deleting card:', apiError);
        
        // If the deletion failed, revert UI changes
        setCards(cards);
        const revertedFilteredCards = applyFiltersAndSort(
          cards,
          selectedTypes,
          selectedTags,
          currentSort,
          searchTerm
        );
        setFilteredCards(revertedFilteredCards);
        
        // Show error to user
        alert('Failed to delete card. Please try again.');
      }
    } catch (error) {
      console.error('Error in delete handler:', error);
      alert('An error occurred while trying to delete the card.');
    }
  };

  const handleCardCreated = async () => {
    // Refetch cards and tags from the API
    try {
      const [cardsResponse, tagsResponse] = await Promise.all([
        fetchCards(),
        getAllTags()
      ]);

      setCards(cardsResponse.cards);
      setAvailableTags(tagsResponse);

      // Apply all current filters and sorting
      const filteredAndSorted = applyFiltersAndSort(
        cardsResponse.cards,
        selectedTypes,
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

      // Refresh the cards and tags - with a larger page size to get all cards
      const [cardsResponse, tagsResponse] = await Promise.all([
        fetchCards(1, { 
          type: selectedTypes, 
          tags: selectedTags, 
          search: searchTerm 
        }, 100), // Use a larger limit to get all cards at once
        getAllTags()
      ]);
      

      // Store the total count
      setTotalCardCount(cardsResponse.totalCount);
      
      // Set all cards first
      setCards(cardsResponse.cards);
      setAvailableTags(tagsResponse);

      // Apply all current filters and sorting
      const filteredAndSorted = applyFiltersAndSort(
        cardsResponse.cards,
        selectedTypes,
        selectedTags,
        currentSort,
        searchTerm
      );
      setFilteredCards(filteredAndSorted);
      
      // No need to refresh the page or restore scroll position
      // Just make sure we have all cards loaded
      if (cardsResponse.cards.length < cardsResponse.totalCount) {
        
        // If we don't have all cards, load the rest
        try {
          const moreCardsResponse = await fetchCards(2, {
            type: selectedTypes,
            tags: selectedTags,
            search: searchTerm
          }, 100);
          
          // Combine with existing cards (avoiding duplicates)
          const allCards = [...cardsResponse.cards];
          moreCardsResponse.cards.forEach(card => {
            if (!allCards.some(c => c.id === card.id)) {
              allCards.push(card);
            }
          });
          
          // Update the state with all cards
          setCards(allCards);
          
          // Reapply filters
          const newFilteredCards = applyFiltersAndSort(
            allCards,
            selectedTypes,
            selectedTags,
            currentSort,
            searchTerm
          );
          setFilteredCards(newFilteredCards);
          
        } catch (error) {
          console.error('Error loading additional cards after update:', error);
        }
      }
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

            <h1 className="text-xl font-bold text-gray-900 hidden sm:block">Affiliate Resources</h1>
          </div>
          
          {/* Navigation row */}
          <div className="mt-3 flex justify-center">
            <Navigation />
          </div>
        </div>
      </header>

      <div className="sticky top-[100px] z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          {/* Controls row - keeps all controls on one line */}
          <div className="flex items-center gap-4">
            {isAdmin && (
              <div className="mr-2">
                <AdminBar
                  onCardCreated={handleCardCreated}
                  availableTags={availableTags}
                  selectedCardType={selectedTypes.length === 0 ? 'all' : selectedTypes[0]}
                />
              </div>
            )}
            <TypeDropdown
              onFilterChange={handleFilterChange}
              selectedTypes={selectedTypes}
            />
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

          {/* Selected tags row - appears below the controls */}
          {selectedTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2 ml-0 items-center">
              <button
                onClick={() => handleFilterChange({ tags: [] })}
                className="flex items-center justify-center text-red-600 hover:text-red-800 mr-1 focus:outline-none"
                title="Clear all tag filters"
                aria-label="Clear all tag filters"
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
        {/* Card count display */}
        {!loading && totalCardCount > 0 && (
          <div className="mb-4 text-gray-600 text-sm">
            Showing {filteredCards.length} of {totalCardCount} cards
            {selectedTypes.length > 0 && ` (${selectedTypes.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(', ')} only)`}
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
              // Implement pagination with the current filters
              try {
                const response = await fetchCards(page, {
                  type: selectedTypes,
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

      {/* Login Modal */}
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

      {/* Edit Card Modal */}
      {showEditModal && currentEditCard && (
        <CardUploadModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            
            // Just clear the last edited card ID
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
