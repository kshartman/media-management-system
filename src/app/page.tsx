'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import CardFactory from '../components/cards/CardFactory';
import TypeDropdown from '../components/filters/TypeDropdown';
import TagDropdown from '../components/filters/TagDropdown';
import SortDropdown, { SortOption } from '../components/filters/SortDropdown';
import SearchField from '../components/filters/SearchField';
import LoginForm from '../components/auth/LoginForm';
import AdminBar from '../components/admin/AdminBar';
import CardUploadModal from '../components/admin/CardUploadModal';
import { CardProps, ImageCardProps, SocialCardProps, ReelCardProps } from '../types';
import { useAuth } from '../lib/authContext';
import { fetchCards, deleteCard, updateCard, getAllTags } from '../lib/api';

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
    documentCopy: 'https://example.com/social-media-copy.pdf',
    tags: ['marketing', 'social media'],
    description: 'Social media post template for summer campaign',
  },
  {
    id: '3',
    type: 'reel',
    preview: 'https://placehold.co/600x400/f39c12/FFFFFF/png?text=Video+Testimonial',
    movie: 'https://example.com/video.mp4',
    transcript: 'https://example.com/transcript.txt',
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
  const { isAdmin, _login, logout } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentEditCard, setCurrentEditCard] = useState<CardProps | undefined>(undefined);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['image']);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [currentSort, setCurrentSort] = useState<SortOption>('newest');
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredCards, setFilteredCards] = useState<CardProps[]>([]);
  const [cards, setCards] = useState<CardProps[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Fetch cards and tags from the API when the component mounts
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // Load cards and tags concurrently
        const [cardsResponse, tagsResponse] = await Promise.all([
          fetchCards(),
          getAllTags()
        ]);

        setCards(cardsResponse.cards);
        setAvailableTags(tagsResponse);

        // Filter to show only image cards by default and apply sorting
        const initialFiltered = applyFiltersAndSort(
          cardsResponse.cards,
          ['image'],  // Default to image type
          [],         // No tags selected by default
          'newest',   // Default sort to newest
          ''          // No search term
        );
        setFilteredCards(initialFiltered);
      } catch (error) {
        console.error('Error loading data:', error);
        // Fallback to sample cards if API fails
        setCards(SampleCards);
        // Filter to show only image cards by default and apply sorting
        const initialFiltered = applyFiltersAndSort(
          SampleCards,
          ['image'],  // Default to image type
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
      filtered = filtered.filter(card => types.includes(card.type));
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
            files.push((card as unknown as SocialCardProps).documentCopy);
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

  const handleFilterChange = (filters: { type?: string[], tags?: string[] }) => {
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

    // Apply filters and sort
    const filteredAndSorted = applyFiltersAndSort(cards, types, tags, currentSort, searchTerm);
    setFilteredCards(filteredAndSorted);
  };

  // Handle sorting change
  const handleSortChange = (sortOption: SortOption) => {
    setCurrentSort(sortOption);

    // Re-apply current filters with new sort option
    const filteredAndSorted = applyFiltersAndSort(cards, selectedTypes, selectedTags, sortOption, searchTerm);
    setFilteredCards(filteredAndSorted);
  };

  // Handle search changes
  const handleSearch = (search: string) => {
    setSearchTerm(search);

    // Re-apply current filters with new search term
    const filteredAndSorted = applyFiltersAndSort(cards, selectedTypes, selectedTags, currentSort, search);
    setFilteredCards(filteredAndSorted);
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
      // Re-create the card object to ensure React detects the change
      const cardCopy = {...cardToEdit};
      setCurrentEditCard(cardCopy);
      setShowEditModal(true);
    }
  };

  const handleDeleteCard = async (id: string) => {
    try {
      await deleteCard(id);
      // Remove card from state after successful deletion
      const updatedCards = cards.filter(card => card.id !== id);
      setCards(updatedCards);
      setFilteredCards(updatedCards);
    } catch (error) {
      console.error('Error deleting card:', error);
      alert('Failed to delete card. Please try again.');
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

      // Refresh the cards and tags
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
      console.error('Error updating card:', error);
      alert('Failed to update card. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#d9f2fc] border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center relative">
          <h1 className="text-xl font-bold text-gray-900 hidden sm:block">Affiliate Resources</h1>

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

          <button
            onClick={handleLoginClick}
            className="text-sm bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-2"
          >
            {isAdmin ? 'Logout' : 'Admin Login'}
          </button>
        </div>
      </header>

      <div className="sticky top-[60px] z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          {/* Controls row - keeps all controls on one line */}
          <div className="flex items-center gap-4">
            {isAdmin && (
              <div className="mr-2">
                <AdminBar
                  onCardCreated={handleCardCreated}
                  availableTags={availableTags}
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

        {loading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredCards.map((card) => (
              <div key={card.id}>
                <CardFactory
                  {...card}
                  isAdmin={isAdmin}
                  onEdit={isAdmin ? handleEditCard : undefined}
                  onDelete={isAdmin ? handleDeleteCard : undefined}
                />
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Login Modal */}
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

      {/* Edit Card Modal */}
      {showEditModal && currentEditCard && (
        <CardUploadModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSubmit={handleCardUpdated}
          initialData={currentEditCard}
          availableTags={availableTags}
        />
      )}
    </div>
  );
}
