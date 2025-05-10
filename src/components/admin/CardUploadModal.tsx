'use client';

import React from 'react';
import { CardProps } from '../../types';
import CardFormNew from './CardFormNew';

interface CardUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: FormData) => Promise<void>;
  initialData?: CardProps;
  availableTags?: string[];
}

const CardUploadModal: React.FC<CardUploadModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  availableTags = [],
}) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full">
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h3 className="text-xl font-semibold text-gray-900">
            {initialData ? 'Edit Card' : 'Upload New Card'}
          </h3>
          <button
            className="text-gray-500 hover:text-gray-700"
            onClick={onClose}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        
        <div className="px-6 py-4">
          <CardFormNew
            key={initialData?.id || 'new'} // Using key to force recreation when card changes
            initialData={initialData}
            onSubmit={onSubmit}
            onCancel={onClose}
            availableTags={availableTags}
          />
        </div>
      </div>
    </div>
  );
};

export default CardUploadModal;