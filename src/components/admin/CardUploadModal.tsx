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
  initialCardType?: string;
}

const CardUploadModal: React.FC<CardUploadModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  availableTags = [],
  initialCardType = 'image',
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Reset states whenever the modal opens or closes
  useEffect(() => {
    // If modal is opening, make sure we clear states
    if (isOpen) {
      setIsSubmitting(false);
      setFormError(null);
    }
  }, [isOpen]);

  // Monitor form submission status
  useEffect(() => {
    if (!isOpen) return;

    const handleSubmitStart = () => {
      setIsSubmitting(true);
      setFormError(null); // Clear previous errors when starting submission
    };
    
    const handleSubmitEnd = () => {
      setIsSubmitting(false);
    };

    const handleSubmitError = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      setFormError(customEvent.detail);
      setIsSubmitting(false);
    };

    document.addEventListener('form-submit-start', handleSubmitStart);
    document.addEventListener('form-submit-end', handleSubmitEnd);
    document.addEventListener('form-submit-error', handleSubmitError);

    return () => {
      document.removeEventListener('form-submit-start', handleSubmitStart);
      document.removeEventListener('form-submit-end', handleSubmitEnd);
      document.removeEventListener('form-submit-error', handleSubmitError);
    };
  }, [isOpen]);

  // When modal opens, fix body scroll
  useEffect(() => {
    if (!isOpen) return;

    // Store the original styles and scroll position
    const originalStyle = window.getComputedStyle(document.body).overflow;
    const scrollY = window.scrollY;
    
    // Store the scroll position value in local state for this component instance
    // (we'll still use the context for restoration across navigation)
    const scrollPosForThisModal = scrollY;
    
    // Lock body scroll and fix position
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.top = `-${scrollY}px`;
    document.documentElement.style.overflow = 'hidden';

    return () => {
      // Restore original style when component unmounts
      document.body.style.overflow = originalStyle;
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      document.documentElement.style.overflow = '';
      
      // Restore scroll position
      window.scrollTo(0, scrollPosForThisModal);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Fixed overlay covering entire viewport */}
      <div className="fixed inset-0 z-40 bg-black bg-opacity-60" />
      
      {/* Modal container with overflow handling */}
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-screen items-center justify-center p-4">
          {/* Loading overlay - appears when submitting */}
          {isSubmitting && (
            <div className="fixed inset-0 z-[60] bg-white bg-opacity-70 flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mb-4"></div>
              <p className="text-gray-800 text-lg font-semibold">Saving card...</p>
              <p className="text-gray-600 mt-2">This may take several seconds for video uploads.</p>
            </div>
          )}
  
          {/* Modal content */}
          <div className="relative w-full max-w-3xl">
            {/* Modal backdrop for closing */}
            <div 
              className="fixed inset-0 -z-10"
              onClick={isSubmitting ? undefined : onClose}
              role={isSubmitting ? undefined : "button"}
              tabIndex={isSubmitting ? undefined : 0}
              onKeyDown={isSubmitting ? undefined : (e) => {
                if (e.key === 'Enter' || e.key === 'Escape') {
                  onClose();
                }
              }}
              aria-label={isSubmitting ? undefined : "Close modal"}
              id="modal-backdrop"
            />
            
            {/* Modal box */}
            <div className="bg-white rounded-lg shadow-2xl border border-gray-200">
              {/* Show error message if there is one */}
              {formError && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-t-lg relative" role="alert">
                  <strong className="font-bold">Error: </strong>
                  <span className="block sm:inline">{formError}</span>
                  <span className="absolute top-0 bottom-0 right-0 px-4 py-3">
                    <button 
                      onClick={() => setFormError(null)} 
                      className="text-red-600 hover:text-red-800"
                      aria-label="Close error message"
                    >
                      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 8.586L6.707 5.293a1 1 0 00-1.414 1.414L8.586 10l-3.293 3.293a1 1 0 101.414 1.414L10 11.414l3.293 3.293a1 1 0 001.414-1.414L11.414 10l3.293-3.293a1 1 0 00-1.414-1.414L10 8.586z" clipRule="evenodd"/>
                      </svg>
                    </button>
                  </span>
                </div>
              )}
              
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
                    id="modal-close-button"
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
                  initialCardType={initialCardType}
                  onSubmit={onSubmit}
                  onCancel={onClose}
                  availableTags={availableTags}
                  isSubmitting={isSubmitting}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CardUploadModal;