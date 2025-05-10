'use client';

import React, { useState, useEffect } from 'react';
import CardFactory from '../components/cards/CardFactory';
import TypeDropdown from '../components/filters/TypeDropdown';
import LoginForm from '../components/auth/LoginForm';
import AdminBar from '../components/admin/AdminBar';
import CardUploadModal from '../components/admin/CardUploadModal';
import { CardProps } from '../types';
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
  const { isAdmin, login, logout } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentEditCard, setCurrentEditCard] = useState<CardProps | undefined>(undefined);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['image']);
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

        // Filter to show only image cards by default
        setFilteredCards(cardsResponse.cards.filter(card => card.type === 'image'));
      } catch (error) {
        console.error('Error loading data:', error);
        // Fallback to sample cards if API fails
        setCards(SampleCards);
        // Filter to show only image cards by default
        setFilteredCards(SampleCards.filter(card => card.type === 'image'));
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);
  
  const handleFilterChange = (filters: { type?: string[] }) => {
    if (filters.type) {
      setSelectedTypes(filters.type);
      
      if (filters.type.length === 0) {
        // If no filters selected, show all cards
        setFilteredCards(cards);
      } else {
        // Filter cards by selected types
        setFilteredCards(cards.filter(card => filters.type!.includes(card.type)));
      }
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

      // Update filtered cards based on current selection
      if (selectedTypes.length > 0) {
        setFilteredCards(cardsResponse.cards.filter(card => selectedTypes.includes(card.type)));
      } else {
        setFilteredCards(cardsResponse.cards);
      }
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

      // Update filtered cards based on current selection
      if (selectedTypes.length > 0) {
        setFilteredCards(cardsResponse.cards.filter(card => selectedTypes.includes(card.type)));
      } else {
        setFilteredCards(cardsResponse.cards);
      }
    } catch (error) {
      console.error('Error updating card:', error);
      alert('Failed to update card. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Media Management System</h1>

          <button
            onClick={handleLoginClick}
            className="text-sm bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-2"
          >
            {isAdmin ? 'Logout' : 'Admin Login'}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {isAdmin && (
          <AdminBar
            onCardCreated={handleCardCreated}
            availableTags={availableTags}
          />
        )}

        <div className="mb-6">
          <TypeDropdown
            onFilterChange={handleFilterChange}
            selectedTypes={selectedTypes}
          />
        </div>

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