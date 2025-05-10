'use client';

import React, { useState } from 'react';
import CardFactory from '../components/cards/CardFactory';
import TypeDropdown from '../components/filters/TypeDropdown';
import { CardProps } from '../types';

// Sample cards for testing
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [filteredCards, setFilteredCards] = useState<CardProps[]>(SampleCards);

  const handleFilterChange = (filters: { type?: string[] }) => {
    if (filters.type) {
      setSelectedTypes(filters.type);

      if (filters.type.length === 0) {
        // If no filters selected, show all cards
        setFilteredCards(SampleCards);
      } else {
        // Filter cards by selected types
        setFilteredCards(SampleCards.filter(card => filters.type!.includes(card.type)));
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Media Management System</h1>

          <button
            onClick={() => setIsAdmin(!isAdmin)}
            className="text-sm bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-2"
          >
            {isAdmin ? 'Logout' : 'Admin Login'}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <TypeDropdown
            onFilterChange={handleFilterChange}
            selectedTypes={selectedTypes}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredCards.map((card) => (
            <div key={card.id}>
              <CardFactory
                {...card}
                isAdmin={isAdmin}
                onEdit={isAdmin ? (id) => console.log(`Edit card ${id}`) : undefined}
                onDelete={isAdmin ? (id) => console.log(`Delete card ${id}`) : undefined}
              />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}