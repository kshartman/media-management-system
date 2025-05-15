'use client';

import React, { useState, useEffect, useCallback } from 'react';
import RichTextEditor from '../ui/RichTextEditor';

interface SocialCopyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (instagramCopy: string, facebookCopy: string) => void;
  initialInstagramCopy?: string;
  initialFacebookCopy?: string;
  initialActiveTab?: 'instagram' | 'facebook';
  isSubmitting?: boolean;
}

const SocialCopyModal: React.FC<SocialCopyModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialInstagramCopy = '',
  initialFacebookCopy = '',
  initialActiveTab = 'instagram',
  isSubmitting = false,
}) => {
  const [instagramCopy, setInstagramCopy] = useState(initialInstagramCopy);
  const [facebookCopy, setFacebookCopy] = useState(initialFacebookCopy);
  const [activeTab, setActiveTab] = useState<'instagram' | 'facebook'>(initialActiveTab);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setInstagramCopy(initialInstagramCopy);
      setFacebookCopy(initialFacebookCopy);
      setActiveTab(initialActiveTab);
    }
  }, [isOpen, initialInstagramCopy, initialFacebookCopy, initialActiveTab]);

  // Memoize the save handler to avoid dependency issues
  const handleSave = useCallback(() => {
    onSave(instagramCopy, facebookCopy);
    onClose();
  }, [onSave, onClose, instagramCopy, facebookCopy]);

  // Prevent body scrolling when modal is open and scroll modal into view
  useEffect(() => {
    if (isOpen) {
      // Lock scrolling on body and html
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = `-${window.scrollY}px`;
      document.documentElement.style.overflow = 'hidden';
      
      // Store current scroll position
      const scrollY = window.scrollY;
      
      // Scroll modal into view after a small delay to ensure it's rendered
      setTimeout(() => {
        const modalElement = document.querySelector('.social-copy-modal');
        if (modalElement) {
          modalElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      
      // Add keyboard shortcuts:
      // - Ctrl+Enter to save
      // - Escape to cancel and close
      const handleKeyDown = (e: KeyboardEvent) => {
        // Ctrl+Enter or Cmd+Enter to save
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !isSubmitting) {
          handleSave();
        }
        // Escape to cancel and close
        else if (e.key === 'Escape' && !isSubmitting) {
          e.preventDefault();
          onClose();
        }
      };
      
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        
        // Restore scrolling and position
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.top = '';
        document.documentElement.style.overflow = '';
        
        // Restore scroll position
        window.scrollTo(0, scrollY);
      };
    } else {
      // Reset styles when modal closes
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      // Cleanup function to ensure styles are reset if component unmounts
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      document.documentElement.style.overflow = '';
    };
  }, [isOpen, handleSave]);
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-hidden">
      <div className="social-copy-modal bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col m-auto">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold">Edit Social Copy</h2>
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              className={`p-1 rounded relative group ${
                isSubmitting 
                  ? 'text-gray-400 cursor-not-allowed' 
                  : 'text-green-600 hover:text-green-800 hover:bg-green-50'
              }`}
              aria-label="Save"
              id="modal-submit-button"
              title="Save (Ctrl+Enter)"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <svg 
                  className="animate-spin h-6 w-6 text-gray-400" 
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
                  className="h-6 w-6" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M5 13l4 4L19 7" 
                  />
                </svg>
              )}
            </button>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
              aria-label="Close"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-6 w-6" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M6 18L18 6M6 6l12 12" 
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-4 flex-grow overflow-auto">
          <div className="flex border-b">
            <button
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === 'instagram'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('instagram')}
            >
              Instagram Copy
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === 'facebook'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('facebook')}
            >
              Facebook Copy
            </button>
          </div>

          <div className="mt-4">
            {activeTab === 'instagram' && (
              <div>
                <h3 className="text-sm font-medium mb-2">Instagram Copy</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Add your Instagram caption with hashtags, mentions, and emojis.
                </p>
                <RichTextEditor
                  initialContent={instagramCopy}
                  onChange={setInstagramCopy}
                  placeholder="Write your Instagram copy here..."
                />
              </div>
            )}

            {activeTab === 'facebook' && (
              <div>
                <h3 className="text-sm font-medium mb-2">Facebook Copy</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Add your Facebook post content with links, formatting, and emojis.
                </p>
                <RichTextEditor
                  initialContent={facebookCopy}
                  onChange={setFacebookCopy}
                  placeholder="Write your Facebook copy here..."
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SocialCopyModal;