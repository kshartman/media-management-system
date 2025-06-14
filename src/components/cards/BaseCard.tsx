'use client';

import React, { useState, useEffect } from 'react';
import { BaseCardProps } from '../../types';
import StandaloneSocialCopyEditor from './StandaloneSocialCopyEditor';
import { useScroll } from '../../contexts/ScrollContext';

const BaseCard: React.FC<React.PropsWithChildren<BaseCardProps>> = ({
  id,
  tags,
  description,
  fileMetadata: _fileMetadata,
  children,
  onEdit,
  onDelete,
  onRefresh,
  isAdmin = false,
  type: _type,
  preview: _preview,
  download: _download,
  movie: _movie,
  transcript: _transcript,
  imageSequence: _imageSequence,
  instagramCopy,
  facebookCopy,
}) => {
  const { storeScrollPosition, restoreScrollPosition } = useScroll();
  const [isDownloading, setIsDownloading] = useState(false);
  const [showSocialCopyModal, setShowSocialCopyModal] = useState(false);
  const [activeSocialCopy, setActiveSocialCopy] = useState<{type: 'instagram' | 'facebook', content: string} | null>(null);
  const [showSocialCopyEditor, setShowSocialCopyEditor] = useState(false);
  const [updatedCard, setUpdatedCard] = useState<{instagramCopy?: string | null; facebookCopy?: string | null} | null>(null);
  const [localInstagramCopy, setLocalInstagramCopy] = useState<string | undefined>(instagramCopy);
  const [localFacebookCopy, setLocalFacebookCopy] = useState<string | undefined>(facebookCopy);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isTagsExpanded, setIsTagsExpanded] = useState(false);
  const [showMoreVisible, setShowMoreVisible] = useState(false);

  // Function to fetch a file and return it as an ArrayBuffer
  const _fetchFileAsArrayBuffer = async (url: string): Promise<{ data: ArrayBuffer, filename: string }> => {
    if (!url) {
      throw new Error('No URL provided for download');
    }


    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }

      const data = await response.arrayBuffer();
      const filename = url.split('/').pop() || 'file';

      return { data, filename };
    } catch (error) {
      console.error('Error fetching file:', error);
      throw error;
    }
  };

  // Function to download a single file directly (used by the overlay download button)
  const _downloadFile = async (url: string | undefined, suggestedName?: string) => {
    if (!url) {
      return;
    }

    try {
      // Create an invisible anchor element
      const anchor = document.createElement('a');
      anchor.style.display = 'none';

      // Set download attribute with suggested filename if available
      if (suggestedName) {
        anchor.download = suggestedName;
      } else {
        // Extract filename from URL path
        const filename = url.split('/').pop() || 'file';
        anchor.download = filename;
      }

      // Set the href to the file URL
      anchor.href = url;

      // Append to the document, click, and remove
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  // Handle downloading all files for this card as a ZIP using server-side endpoint
  const handleDownloadAll = async () => {
    if (isDownloading) return;

    setIsDownloading(true);

    try {
      // Call the server-side ZIP creation endpoint
      const response = await fetch(`/api/cards/${id}/download-package`);
      
      if (!response.ok) {
        throw new Error(`Failed to create ZIP package: ${response.statusText}`);
      }

      const result = await response.json();
      const downloadUrl = result.downloadUrl;

      if (!downloadUrl) {
        throw new Error('No download URL received from server');
      }


      // Create a temporary link to trigger the download
      const downloadLink = document.createElement('a');
      downloadLink.href = downloadUrl;
      downloadLink.style.display = 'none';
      
      // Extract filename from URL for the download
      const urlParts = downloadUrl.split('/');
      const filename = urlParts[urlParts.length - 1];
      downloadLink.download = filename;
      
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

    } catch (error) {
      console.error('Error downloading ZIP file:', error);
      // You could add user-facing error handling here, like a toast notification
    } finally {
      setIsDownloading(false);
    }
  };

  // Handle opening social copy
  const handleOpenSocialCopy = (type: 'instagram' | 'facebook') => {
    const content = type === 'instagram' ? localInstagramCopy : localFacebookCopy;
    if (content) {
      // Store the scroll position when opening the social copy modal
      storeScrollPosition();
      
      // Always show the lightbox regardless of admin status
      setActiveSocialCopy({ type, content });
      setShowSocialCopyModal(true);
    }
  };

  // Effect to update local social copy state from props when they change
  useEffect(() => {
    setLocalInstagramCopy(instagramCopy);
    setLocalFacebookCopy(facebookCopy);
  }, [instagramCopy, facebookCopy]);

  // Effect to update local social copy state from updatedCard
  useEffect(() => {
    if (updatedCard) {
      // Update local state for social copy - handle null values (deleted content)
      if ('instagramCopy' in updatedCard) {
        setLocalInstagramCopy(updatedCard.instagramCopy || undefined);
      }
      if ('facebookCopy' in updatedCard) {
        setLocalFacebookCopy(updatedCard.facebookCopy || undefined);
      }
      
      // Clear the updated card data after processing to avoid stale updates
      setUpdatedCard(null);
    }
  }, [updatedCard]);

  // Effect to check if tags overflow beyond 2 rows
  useEffect(() => {
    // Check if tags would overflow beyond 2 rows
    const checkTagsOverflow = () => {
      const tagsContainer = document.querySelector(`[data-card-id="${id}"] .tags-container`);
      if (tagsContainer) {
        const tempContainer = tagsContainer.cloneNode(true) as HTMLElement;
        tempContainer.style.height = 'auto';
        tempContainer.style.position = 'absolute';
        tempContainer.style.visibility = 'hidden';
        tempContainer.style.width = tagsContainer.clientWidth + 'px';
        document.body.appendChild(tempContainer);
        
        const actualHeight = tempContainer.scrollHeight;
        const twoRowHeight = 48; // h-12 = 48px
        
        setShowMoreVisible(actualHeight > twoRowHeight);
        document.body.removeChild(tempContainer);
      }
    };

    if (tags && tags.length > 0) {
      // Small delay to ensure DOM is rendered
      setTimeout(checkTagsOverflow, 100);
    }
  }, [tags, id]);

  // Body scroll locking effect for social copy modal
  useEffect(() => {
    if (!showSocialCopyModal) return;

    // Store the original styles and scroll position
    const originalStyle = window.getComputedStyle(document.body).overflow;
    const scrollY = window.scrollY;
    
    // Store the scroll position value in local state for this component instance
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
  }, [showSocialCopyModal]);

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden flex flex-col h-full" data-card-id={id}>
      {/* Social Copy Viewer Modal */}
      {showSocialCopyModal && activeSocialCopy && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-auto" 
          role="dialog"
          aria-modal="true"
          onClick={() => {
            setShowSocialCopyModal(false);
            // Restore scroll position when closing the modal
            setTimeout(() => {
              restoreScrollPosition();
            }, 100);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setShowSocialCopyModal(false);
              // Restore scroll position when closing the modal
              setTimeout(() => {
                restoreScrollPosition();
              }, 100);
            }
          }}
          tabIndex={-1}
        >
          <div 
            className="bg-white rounded-lg p-6 absolute left-1/2 transform -translate-x-1/2 w-full max-w-2xl px-4 max-h-[80vh] overflow-auto" 
            style={{ top: '120px' }}
            role="document"
            onClick={e => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">
                {activeSocialCopy.type === 'instagram' ? 'Instagram Copy' : 'Facebook Copy'}
              </h3>
              <div className="flex items-center space-x-2">
                {/* Copy button */}
                <button 
                  onClick={() => {
                    // Extract text content from HTML and copy to clipboard
                    const tempEl = document.createElement('div');
                    tempEl.innerHTML = activeSocialCopy.content;
                    const text = tempEl.textContent || tempEl.innerText || '';
                    
                    // Use clipboard API to copy text
                    navigator.clipboard.writeText(text)
                      .then(() => {
                        // Show temporary feedback (could be enhanced with a toast)
                        const button = document.activeElement as HTMLButtonElement;
                        const originalTitle = button.title;
                        button.title = 'Copied!';
                        setTimeout(() => {
                          button.title = originalTitle;
                        }, 2000);
                      })
                      .catch(err => {
                        console.error('Failed to copy text: ', err);
                      });
                  }}
                  className="text-blue-600 hover:text-blue-800 p-1 rounded"
                  title="Copy text to clipboard"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
                
                {/* Edit button - only show for admins */}
                {isAdmin && (
                  <button 
                    onClick={() => {
                      setShowSocialCopyModal(false);
                      setShowSocialCopyEditor(true);
                    }}
                    className="text-green-600 hover:text-green-800 p-1 rounded"
                    title="Edit social copy"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                )}
                
                {/* Close button */}
                <button 
                  onClick={() => {
                    setShowSocialCopyModal(false);
                    // Restore scroll position when closing the modal
                    setTimeout(() => {
                      restoreScrollPosition();
                    }, 100);
                  }}
                  className="text-gray-500 hover:text-gray-700 p-1 rounded"
                  title="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div 
              className="prose max-w-none"
              dangerouslySetInnerHTML={{ __html: activeSocialCopy.content }}
            />
          </div>
        </div>
      )}

      {/* Social Copy Editor Modal */}
      {showSocialCopyEditor && (
        <StandaloneSocialCopyEditor 
          isOpen={showSocialCopyEditor}
          cardId={id}
          initialInstagramCopy={localInstagramCopy}
          initialFacebookCopy={localFacebookCopy}
          onClose={() => setShowSocialCopyEditor(false)}
          onSave={(updatedData) => {
            // Update local state
            setUpdatedCard(updatedData);
            setShowSocialCopyEditor(false);
            // Refresh the card data from the server
            if (onRefresh) {
              onRefresh();
            }
          }}
        />
      )}

      {/* Card content */}
      <div className="flex-1 flex flex-col">
        {children}
        
        {/* Tags and Description Section */}
        <div className="px-4 pt-3">
          {/* Tags - Always reserve space for 2 rows (48px) */}
          <div className="mb-2" style={{ minHeight: '48px' }}>
            <div className={`tags-container flex flex-wrap gap-1 ${isTagsExpanded ? '' : 'overflow-hidden'}`} style={{ maxHeight: isTagsExpanded ? 'none' : '48px' }}>
              {tags && tags.length > 0 ? (
                tags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full h-6"
                  >
                    {tag}
                  </span>
                ))
              ) : null}
            </div>
          </div>

          {/* Description - Always show 2 lines */}
          <div className="mb-3">
            {description && (
              <p className={`text-sm text-gray-700 break-words ${
                isDescriptionExpanded ? '' : 'line-clamp-2'
              }`}>
                {description}
              </p>
            )}
          </div>

          {/* Show More Button - Only show if tags overflow 2 rows OR description is long */}
          {(showMoreVisible || (description && description.length > 100)) && (
            <button
              onClick={() => {
                setIsDescriptionExpanded(!isDescriptionExpanded);
                setIsTagsExpanded(!isTagsExpanded);
              }}
              className="text-blue-600 hover:text-blue-800 text-xs font-medium transition-colors"
            >
              {isDescriptionExpanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>

        {/* Spacer to push action buttons to bottom */}
        <div className="flex-1"></div>
      </div>

      {/* Footer with action buttons only */}
      <div className="p-4 bg-gray-50 flex-shrink-0">

        {/* Action buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Download ZIP button */}
            <button
              onClick={handleDownloadAll}
              disabled={isDownloading}
              className={`text-sm font-medium flex items-center ${
                isDownloading
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-blue-600 hover:text-blue-800'
              }`}
              title="Download all files as ZIP"
              aria-label="Download all files as ZIP"
            >
              {isDownloading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Downloading...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  ZIP
                </>
              )}
            </button>

            {/* Social copy buttons */}
            {localInstagramCopy && (
              <button
                onClick={() => handleOpenSocialCopy('instagram')}
                className="text-sm font-medium text-purple-600 hover:text-purple-800 flex items-center"
                title="View Instagram copy"
                aria-label="View Instagram copy"
              >
                <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
                IG
              </button>
            )}

            {localFacebookCopy && (
              <button
                onClick={() => handleOpenSocialCopy('facebook')}
                className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center"
                title="View Facebook copy"
                aria-label="View Facebook copy"
              >
                <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                FB
              </button>
            )}
          </div>

          {/* Admin controls */}
          {isAdmin && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => onEdit && onEdit(id)}
                className="text-gray-600 hover:text-gray-800"
                title="Edit this item"
                aria-label="Edit this item"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
              </button>
              <button
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
                    if (onDelete && id) {
                      onDelete(id);
                    }
                  }
                }}
                className="text-red-600 hover:text-red-800"
                title="Delete this item"
                aria-label="Delete this item"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BaseCard;