'use client';

import React, { useState } from 'react';

// Simple card display for testing
const SampleCards = [
  {
    id: '1',
    type: 'image',
    preview: 'https://placehold.co/600x400/3498db/FFFFFF/png?text=Mountain+Landscape',
    tags: ['nature', 'landscape'],
    description: 'Beautiful mountain landscape at sunset',
  },
  {
    id: '2',
    type: 'social',
    preview: 'https://placehold.co/600x400/e74c3c/FFFFFF/png?text=Social+Media',
    tags: ['marketing', 'social media'],
    description: 'Social media post template for summer campaign',
  },
  {
    id: '3',
    type: 'reel',
    preview: 'https://placehold.co/600x400/f39c12/FFFFFF/png?text=Video+Testimonial',
    tags: ['video', 'testimonial'],
    description: 'Customer testimonial about our services',
  },
];

type CardType = {
  id: string;
  type: string;
  preview: string;
  tags: string[];
  description: string;
};

export default function Home() {
  const [isAdmin, setIsAdmin] = useState(false);
  
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {SampleCards.map((card: CardType) => (
            <div key={card.id} className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="relative h-48">
                <img 
                  src={card.preview} 
                  alt={card.description}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-4">
                <p className="font-medium text-gray-900 mb-1">{card.description}</p>
                <p className="text-sm text-gray-500 mb-2">Type: {card.type}</p>
                <div className="flex flex-wrap gap-1">
                  {card.tags.map(tag => (
                    <span key={tag} className="inline-block bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}