'use client';

import React, { useState, useEffect } from 'react';
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Monitor form submission status
  useEffect(() => {
    if (!isOpen) return;

    const handleSubmitStart = () => setIsSubmitting(true);
    const handleSubmitEnd = () => setIsSubmitting(false);

    document.addEventListener('form-submit-start', handleSubmitStart);
    document.addEventListener('form-submit-end', handleSubmitEnd);

    return () => {
      document.removeEventListener('form-submit-start', handleSubmitStart);
      document.removeEventListener('form-submit-end', handleSubmitEnd);
    };
  }, [isOpen]);

  // When modal opens, prevent body from hiding scrollbar
  useEffect(() => {
    if (!isOpen) return;

    // Store the original overflow style
    const originalStyle = window.getComputedStyle(document.body).overflow;

    // Ensure scrollbar stays visible
    document.body.style.overflow = 'auto';
    document.body.style.paddingRight = '0';

    return () => {
      // Restore original style when component unmounts
      document.body.style.overflow = originalStyle;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-auto" style={{ backdropFilter: 'blur(2px)' }}>
      <div
        className="fixed inset-0 bg-black bg-opacity-30"
        onClick={onClose}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'Escape') {
            onClose();
          }
        }}
        aria-label="Close modal"
      ></div>
      <div className="relative mx-auto mt-16 mb-16 max-w-3xl">
        <div className="bg-white rounded-lg shadow-2xl border border-gray-200">
          <div className="sticky top-0 z-50 bg-white px-6 py-4 border-b flex justify-between items-center rounded-t-lg">
            <h3 className="text-xl font-semibold text-gray-900">
              {initialData ? 'Edit Card' : 'Upload New Card'}
            </h3>
            <div className="flex items-center space-x-3">
              <button
                id="modal-submit-button"
                disabled={isSubmitting}
                className={`${isSubmitting ? 'text-green-400' : 'text-green-600 hover:text-green-800'}`}
                title={isSubmitting ? 'Saving...' : 'Save'}
              >
                {isSubmitting ? (
                  <svg
                    className="animate-spin h-6 w-6"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    className="h-6 w-6"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </button>
              <button
                className="text-red-500 hover:text-red-700"
                onClick={onClose}
                disabled={isSubmitting}
                title="Cancel"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  className="h-6 w-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
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
    </div>
  );
};

export default CardUploadModal;