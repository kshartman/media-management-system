'use client';

import React, { useState, useEffect } from 'react';
import CardUploadModal from './CardUploadModal';
import UserManagement from './UserManagement';
import { createCard } from '../../lib/api';

interface AdminBarProps {
  onCardCreated: () => void;
  availableTags?: string[];
  selectedCardType?: string;
}

const AdminBar: React.FC<AdminBarProps> = ({ onCardCreated, availableTags = [], selectedCardType = 'image' }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
  const [currentCardType, setCurrentCardType] = useState(selectedCardType);
  
  // Update currentCardType when selectedCardType prop changes
  useEffect(() => {
    console.log('selectedCardType changed in AdminBar:', selectedCardType);
    setCurrentCardType(selectedCardType);
  }, [selectedCardType]);

  const handleCreateCard = async (formData: FormData) => {
    try {
      console.log('Creating card with selectedCardType:', selectedCardType);
      
      // Social card validation - check if we have image sequence files
      if (selectedCardType === 'social') {
        const sequenceCount = formData.get('imageSequenceCount');
        if (!sequenceCount || parseInt(sequenceCount as string, 10) <= 0) {
          throw new Error('At least one image is required for social cards');
        }
      }
      
      await createCard(formData);
      setIsModalOpen(false);
      // Notify parent to refresh cards
      onCardCreated();
    } catch (error) {
      console.error('Error creating card:', error);
      // Don't show alert - we'll handle errors in the modal
      // Just propagate the error to the form component
      throw error;
    }
  };

  return (
    <div className="flex gap-2">
      {/* Add Card Button */}
      <button
        onClick={() => {
          // Update current card type from selected type prop when opening modal
          setCurrentCardType(selectedCardType);
          console.log('Opening modal with card type:', selectedCardType);
          setIsModalOpen(true);
        }}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
        </svg>
        Card
      </button>

      {/* User Management Button */}
      <button
        onClick={() => setIsUserManagementOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zm8 0a3 3 0 11-6 0 3 3 0 016 0zm-4.07 11c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
        </svg>
        Users
      </button>

      {/* Modals */}
      <CardUploadModal
        isOpen={isModalOpen}
        onClose={() => {
          // Ensure all form submit events are cleared when closing the modal
          document.dispatchEvent(new Event('form-submit-end'));
          setIsModalOpen(false);
        }}
        onSubmit={handleCreateCard}
        availableTags={availableTags}
        initialCardType={currentCardType}
      />

      <UserManagement
        isOpen={isUserManagementOpen}
        onClose={() => setIsUserManagementOpen(false)}
      />
    </div>
  );
};

export default AdminBar;