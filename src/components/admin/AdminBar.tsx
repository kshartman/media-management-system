'use client';

import React, { useState } from 'react';
import CardUploadModal from './CardUploadModal';
import { createCard } from '../../lib/api';

interface AdminBarProps {
  onCardCreated: () => void;
}

const AdminBar: React.FC<AdminBarProps> = ({ onCardCreated }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleCreateCard = async (formData: FormData) => {
    try {
      await createCard(formData);
      setIsModalOpen(false);
      onCardCreated();
    } catch (error) {
      console.error('Error creating card:', error);
      throw error;
    }
  };

  return (
    <div className="bg-white shadow-md rounded-lg mb-6">
      <div className="flex justify-between items-center p-4">
        <h2 className="text-lg font-semibold text-gray-800">
          Admin Controls
        </h2>
        
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Upload New Card
        </button>
      </div>

      <CardUploadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateCard}
      />
    </div>
  );
};

export default AdminBar;