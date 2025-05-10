'use client';

import React, { useState } from 'react';
import CardUploadModal from './CardUploadModal';
import { createCard } from '../../lib/api';

interface AdminBarProps {
  onCardCreated: () => void;
  availableTags?: string[];
}

const AdminBar: React.FC<AdminBarProps> = ({ onCardCreated, availableTags = [] }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleCreateCard = async (formData: FormData) => {
    try {
      await createCard(formData);
      setIsModalOpen(false);
      // Notify parent to refresh cards
      onCardCreated();
    } catch (error) {
      console.error('Error creating card:', error);
      alert('Error creating card: ' + (error as Error).message);
      throw error;
    }
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
        </svg>
        Card
      </button>

      <CardUploadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateCard}
        availableTags={availableTags}
      />
    </>
  );
};

export default AdminBar;