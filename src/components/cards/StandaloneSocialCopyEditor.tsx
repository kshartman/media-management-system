'use client';

import React, { useState, useEffect } from 'react';
import { updateSocialCopy } from '../../lib/api';
import SocialCopyModal from './SocialCopyModal';

interface StandaloneSocialCopyEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (updatedCard: { instagramCopy?: string | null; facebookCopy?: string | null }) => void;
  cardId: string;
  initialInstagramCopy?: string;
  initialFacebookCopy?: string;
  initialActiveTab?: 'instagram' | 'facebook';
}

const StandaloneSocialCopyEditor: React.FC<StandaloneSocialCopyEditorProps> = ({
  isOpen,
  onClose,
  onSave,
  cardId,
  initialInstagramCopy = '',
  initialFacebookCopy = '',
  initialActiveTab = 'instagram',
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Handle escape key to close editor
  useEffect(() => {
    if (!isOpen) return;
    
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        e.preventDefault();
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen, onClose, isSubmitting]);

  const handleSaveAndClose = async (instagramCopy: string, facebookCopy: string) => {
    if (!cardId) {
      setError('Missing card ID');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    
    try {
      // Only include non-empty social copy fields to avoid overwriting with empty strings
      // Empty strings after trimming will be deleted from database
      const updateData: { instagramCopy?: string | null, facebookCopy?: string | null } = {};
      
      // If content exists (not empty after trimming), include it
      // Otherwise explicitly set to null to delete from database
      if (instagramCopy) {
        updateData.instagramCopy = instagramCopy;
      } else {
        updateData.instagramCopy = null; // Delete from database if empty
      }
      
      if (facebookCopy) {
        updateData.facebookCopy = facebookCopy;
      } else {
        updateData.facebookCopy = null; // Delete from database if empty
      }
      
      // Save using the PATCH endpoint
      const updatedCard = await updateSocialCopy(cardId, updateData);
      
      // Call the onSave callback if provided
      if (onSave) {
        onSave(updatedCard);
      }
      
      // Close the modal
      onClose();
    } catch (err) {
      setError('Failed to save social copy. Please try again.');
      console.error('Error saving social copy:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {error && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[60] bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <span className="block sm:inline">{error}</span>
          <button 
            className="absolute top-0 bottom-0 right-0 px-4 py-3" 
            onClick={() => setError(null)}
            aria-label="Close error message"
          >
            <svg className="fill-current h-6 w-6 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
              <title>Close</title>
              <path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/>
            </svg>
          </button>
        </div>
      )}
      
      <SocialCopyModal
        isOpen={isOpen}
        onClose={onClose}
        onSave={handleSaveAndClose}
        initialInstagramCopy={initialInstagramCopy}
        initialFacebookCopy={initialFacebookCopy}
        initialActiveTab={initialActiveTab}
        isSubmitting={isSubmitting}
      />
    </>
  );
};

export default StandaloneSocialCopyEditor;