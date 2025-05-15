'use client';

import React, { useState, useEffect } from 'react';
import { BaseCardProps } from '../../types';
import JSZip from 'jszip';
import StandaloneSocialCopyEditor from './StandaloneSocialCopyEditor';
import { useScroll } from '../../contexts/ScrollContext';

const BaseCard: React.FC<React.PropsWithChildren<BaseCardProps>> = ({
  id,
  tags,
  description,
  fileMetadata,
  children,
  onEdit,
  onDelete,
  isAdmin = false,
  type,
  preview,
  download,
  movie,
  transcript,
  imageSequence,
  instagramCopy,
  facebookCopy,
}) => {
  const { storeScrollPosition, restoreScrollPosition } = useScroll();
  const [isDownloading, setIsDownloading] = useState(false);
  const [showSocialCopyModal, setShowSocialCopyModal] = useState(false);
  const [activeSocialCopy, setActiveSocialCopy] = useState<{type: 'instagram' | 'facebook', content: string} | null>(null);
  const [showSocialCopyEditor, setShowSocialCopyEditor] = useState(false);
  const [updatedCard, setUpdatedCard] = useState<any>(null);
  const [localInstagramCopy, setLocalInstagramCopy] = useState<string | undefined>(instagramCopy);
  const [localFacebookCopy, setLocalFacebookCopy] = useState<string | undefined>(facebookCopy);

  // Helper function to extract file extension from URL
  const getExtensionFromUrl = (url: string): string => {
    if (!url) return '';
    const filename = url.split('/').pop() || '';
    const extension = filename.includes('.') ? filename.substring(filename.lastIndexOf('.')) : '';
    return extension || '.jpg'; // Default to .jpg if no extension found
  };
  
  // Function to fetch a file and return it as an ArrayBuffer
  const fetchFileAsArrayBuffer = async (url: string): Promise<{ data: ArrayBuffer, filename: string }> => {
    if (!url) {
      throw new Error('No URL provided for download');
    }

    console.log(`Fetching file: ${url}`);

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
  const downloadFile = async (url: string | undefined, suggestedName?: string) => {
    if (!url) {
      console.log('No URL provided for download');
      return;
    }

    try {
      console.log(`Downloading file: ${url}${suggestedName ? ', with name: ' + suggestedName : ''}`);
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

  // Handle downloading all files for this card as a ZIP
  const handleDownloadAll = async () => {
    if (isDownloading) return;

    console.log('Starting ZIP download process for card type:', type);
    try {
      console.log('Files available:', {
        preview,
        download,
        movie,
        transcript,
        imageSequence: imageSequence || [],
        fileMetadata
      });
    } catch (error) {
      console.error('Error logging files:', error);
      // Continue with download even if logging fails
    }

    setIsDownloading(true);

    try {
      // Create a new ZIP file
      const zip = new JSZip();
      const files: {url: string, name: string}[] = [];

      // Create a more descriptive ZIP filename from description (limited to first 40 chars)
      const safeDescription = description
        .replace(/[^a-zA-Z0-9]/g, '_') // Replace non-alphanumeric with underscores
        .substring(0, 40); // Limit length
      const zipFilename = `${safeDescription}.zip`;

      // Collect files to add to ZIP based on card type
      if (type === 'image') {
        if (download) {
          // For the main image, use original filename or fall back to extracting from URL
          const downloadName = fileMetadata?.downloadOriginalFileName || download.split('/').pop() || 'image.jpg';
          files.push({ url: download, name: downloadName });
        }
        // Only include preview if it exists and we're not already including the same file
        if (preview && preview !== download) {
          const previewName = fileMetadata?.previewOriginalFileName || preview.split('/').pop() || 'preview.jpg';
          files.push({ url: preview, name: previewName });
        }
      }
      else if (type === 'social') {
        // Include all image sequence files with original filenames when available
        if (imageSequence && Array.isArray(imageSequence) && imageSequence.length > 0) {
          const originalFilenames = fileMetadata?.imageSequenceOriginalFileNames || [];
          
          for (let i = 0; i < imageSequence.length; i++) {
            const imageUrl = imageSequence[i];
            if (!imageUrl) continue;
            
            // Use original filename if available, otherwise fallback to URL basename or generated name
            const imageName = originalFilenames[i] || 
                            imageUrl.split('/').pop() || 
                            `image-${i+1}${getExtensionFromUrl(imageUrl)}`;
            
            files.push({ url: imageUrl, name: imageName });
          }
        }
        
        // Include transcript if it exists
        if (transcript) {
          const transcriptName = fileMetadata?.transcriptOriginalFileName || transcript.split('/').pop() || 'transcript.txt';
          files.push({ url: transcript, name: transcriptName });
        }
        
        // Include preview only if:
        // 1. It exists
        // 2. It's not already in the image sequence
        // 3. It's an explicitly uploaded preview (has an original filename) or is not the first image in the sequence
        if (preview && 
            (!imageSequence || !imageSequence.includes(preview)) && 
            (fileMetadata?.previewOriginalFileName || (imageSequence && imageSequence.length > 0 && preview !== imageSequence[0]))) {
          const previewName = fileMetadata?.previewOriginalFileName || preview.split('/').pop() || 'preview.jpg';
          files.push({ url: preview, name: previewName });
        }
        
        // Generate Social Copy Files - only on client side for now
        
        // Add Instagram copy in multiple formats if present
        if (localInstagramCopy) {
          // Plain text version with preserved formatting
          // Replace paragraphs with double newlines and line breaks with single newlines
          const instagramText = localInstagramCopy
            .replace(/<p[^>]*>/gi, '')
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<br[^>]*>/gi, '\n')
            .replace(/<[^>]*>/g, '') // Remove remaining HTML tags
            .replace(/&nbsp;/g, ' ')  // Convert non-breaking spaces to regular spaces
            .replace(/&amp;/g, '&')   // Convert &amp; to &
            .replace(/&lt;/g, '<')    // Convert &lt; to <
            .replace(/&gt;/g, '>')    // Convert &gt; to >
            .replace(/&quot;/g, '"')  // Convert &quot; to "
            .replace(/&#39;/g, "'");  // Convert &#39; to '
            
          files.push({ 
            url: 'data:text/plain;charset=utf-8,' + encodeURIComponent(instagramText), 
            name: 'instagram_copy.txt' 
          });
        }
        
        // Add Facebook copy in multiple formats if present
        if (localFacebookCopy) {
          // Plain text version with preserved formatting
          // Replace paragraphs with double newlines and line breaks with single newlines
          const facebookText = localFacebookCopy
            .replace(/<p[^>]*>/gi, '')
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<br[^>]*>/gi, '\n')
            .replace(/<[^>]*>/g, '') // Remove remaining HTML tags
            .replace(/&nbsp;/g, ' ')  // Convert non-breaking spaces to regular spaces
            .replace(/&amp;/g, '&')   // Convert &amp; to &
            .replace(/&lt;/g, '<')    // Convert &lt; to <
            .replace(/&gt;/g, '>')    // Convert &gt; to >
            .replace(/&quot;/g, '"')  // Convert &quot; to "
            .replace(/&#39;/g, "'");  // Convert &#39; to '
            
          files.push({ 
            url: 'data:text/plain;charset=utf-8,' + encodeURIComponent(facebookText), 
            name: 'facebook_copy.txt' 
          });
        }
      }
      else if (type === 'reel') {
        if (movie) {
          const movieName = fileMetadata?.movieOriginalFileName || movie.split('/').pop() || 'video.mp4';
          files.push({ url: movie, name: movieName });
        }
        if (transcript) {
          const transcriptName = fileMetadata?.transcriptOriginalFileName || transcript.split('/').pop() || 'transcript.txt';
          files.push({ url: transcript, name: transcriptName });
        }
        // Only include preview if it exists
        if (preview) {
          const previewName = fileMetadata?.previewOriginalFileName || preview.split('/').pop() || 'thumbnail.jpg';
          files.push({ url: preview, name: previewName });
        }
        
        // Generate Social Copy Files - only on client side for now
        
        // Add Instagram copy in multiple formats if present
        if (localInstagramCopy) {
          // Plain text version with preserved formatting
          // Replace paragraphs with double newlines and line breaks with single newlines
          const instagramText = localInstagramCopy
            .replace(/<p[^>]*>/gi, '')
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<br[^>]*>/gi, '\n')
            .replace(/<[^>]*>/g, '') // Remove remaining HTML tags
            .replace(/&nbsp;/g, ' ')  // Convert non-breaking spaces to regular spaces
            .replace(/&amp;/g, '&')   // Convert &amp; to &
            .replace(/&lt;/g, '<')    // Convert &lt; to <
            .replace(/&gt;/g, '>')    // Convert &gt; to >
            .replace(/&quot;/g, '"')  // Convert &quot; to "
            .replace(/&#39;/g, "'");  // Convert &#39; to '
            
          files.push({ 
            url: 'data:text/plain;charset=utf-8,' + encodeURIComponent(instagramText), 
            name: 'instagram_copy.txt' 
          });
        }
        
        // Add Facebook copy in multiple formats if present
        if (localFacebookCopy) {
          // Plain text version with preserved formatting
          // Replace paragraphs with double newlines and line breaks with single newlines
          const facebookText = localFacebookCopy
            .replace(/<p[^>]*>/gi, '')
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<br[^>]*>/gi, '\n')
            .replace(/<[^>]*>/g, '') // Remove remaining HTML tags
            .replace(/&nbsp;/g, ' ')  // Convert non-breaking spaces to regular spaces
            .replace(/&amp;/g, '&')   // Convert &amp; to &
            .replace(/&lt;/g, '<')    // Convert &lt; to <
            .replace(/&gt;/g, '>')    // Convert &gt; to >
            .replace(/&quot;/g, '"')  // Convert &quot; to "
            .replace(/&#39;/g, "'");  // Convert &#39; to '
            
          files.push({ 
            url: 'data:text/plain;charset=utf-8,' + encodeURIComponent(facebookText), 
            name: 'facebook_copy.txt' 
          });
        }
      }

      if (files.length === 0) {
        console.error('No files available to download');
        return;
      }
      
      // Separate preview images from the sequence
      const mainFiles: {url: string, name: string}[] = [];
      let previewFile: {url: string, name: string} | null = null;
      
      // Check each file to identify preview images
      files.forEach(file => {
        // Determine if this is a preview image
        const isPreview = (
          // For image cards, if it's not the main download image
          (type === 'image' && file.url === preview && file.url !== download) ||
          // For social cards, if it's a preview file and not in the image sequence
          (type === 'social' && file.url === preview && (!imageSequence || !imageSequence.includes(file.url))) ||
          // For reel cards, if it's a preview image
          (type === 'reel' && file.url === preview)
        );
        
        if (isPreview) {
          previewFile = file as {url: string, name: string};
        } else {
          mainFiles.push(file);
        }
      });
      
      // Create a text file listing the files in order
      // The text content will include all files with their order numbers
      let fileListContent = `File Order for "${description}"\n`;
      fileListContent += `Date: ${new Date().toLocaleDateString()}\n`;
      fileListContent += `Type: ${type.charAt(0).toUpperCase() + type.slice(1)}\n`;
      
      // Show total count of files
      fileListContent += `Number of files: ${files.length}\n\n`;
      
      // Add the main files in order
      fileListContent += `FILES IN ORDER:\n`;
      mainFiles.forEach((file, index) => {
        fileListContent += `${index + 1}. ${file.name}\n`;
      });
      
      // Add preview file separately if it exists
      if (previewFile) {
        const previewFilename = typeof previewFile === 'object' && previewFile !== null 
          ? (previewFile as {name: string}).name 
          : 'preview';
        fileListContent += `\nPREVIEW IMAGE: ${previewFilename}\n`;
      }
      
      // Add information about social copy files
      if (localInstagramCopy) {
        fileListContent += `\nINSTAGRAM COPY:\n`;
        fileListContent += `- instagram_copy.txt (text with preserved formatting)\n`;
      }
      
      if (localFacebookCopy) {
        fileListContent += `\nFACEBOOK COPY:\n`;
        fileListContent += `- facebook_copy.txt (text with preserved formatting)\n`;
      }
      
      // Add tags if available
      if (tags && tags.length > 0) {
        fileListContent += `\nTags: ${tags.join(', ')}\n`;
      }
      
      // Add the file list text file to the ZIP
      zip.file('file_order.txt', fileListContent);

      // Recombine all files for actual downloading
      const allFilesToDownload = [...mainFiles];
      if (previewFile) {
        allFilesToDownload.push(previewFile);
      }

      // Fetch all files and add them to the ZIP using our proxy API
      console.log('Fetching files for ZIP:', allFilesToDownload);
      for (const file of allFilesToDownload) {
        try {
          // Use our proxy API to avoid CORS issues
          const proxyUrl = `/api/file-proxy?url=${encodeURIComponent(file.url)}`;
          console.log(`Fetching file via proxy: ${proxyUrl}`);

          const response = await fetch(proxyUrl);
          if (!response.ok) {
            console.error(`Failed to fetch file: ${file.url} via proxy`);
            continue;
          }
          const fileData = await response.blob();
          zip.file(file.name, fileData);
        } catch (error) {
          console.error(`Error fetching file ${file.url}:`, error);
        }
      }

      // Generate ZIP file
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      // Create download link for ZIP
      const downloadUrl = URL.createObjectURL(zipBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = downloadUrl;
      downloadLink.download = zipFilename;
      downloadLink.style.display = 'none';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      // Clean up the object URL
      setTimeout(() => {
        URL.revokeObjectURL(downloadUrl);
      }, 1000);

    } catch (error) {
      console.error('Error creating ZIP file:', error);
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
      // Update local state for social copy
      if (updatedCard.instagramCopy !== undefined) {
        setLocalInstagramCopy(updatedCard.instagramCopy);
      }
      if (updatedCard.facebookCopy !== undefined) {
        setLocalFacebookCopy(updatedCard.facebookCopy);
      }
    }
  }, [updatedCard]);

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden flex flex-col h-full">
      {/* Social Copy Viewer Modal */}
      {showSocialCopyModal && activeSocialCopy && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" 
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
          tabIndex={0}
        >
          <div className="bg-white rounded-lg p-6 max-w-2xl max-h-[80vh] overflow-auto w-full mx-4" onClick={e => e.stopPropagation()}>
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
                        console.error('Could not copy text: ', err);
                      });
                  }}
                  className="text-gray-500 hover:text-gray-700 p-1 rounded hover:bg-gray-100"
                  title="Copy to clipboard"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                </button>
                
                {/* Edit button - only for admins */}
                {isAdmin && (
                  <button 
                    onClick={() => {
                      // Close the view modal
                      setShowSocialCopyModal(false);
                      
                      // Open the standalone editor instead of the card editor
                      setTimeout(() => {
                        setShowSocialCopyEditor(true);
                      }, 100);
                      
                      // We don't restore scroll position here because we're moving to another modal
                    }}
                    className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50"
                    title="Edit social copy"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                  className="text-gray-500 hover:text-gray-700 p-1 rounded hover:bg-gray-100"
                  title="Close"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
      
      {/* Standalone Social Copy Editor */}
      {isAdmin && (
        <StandaloneSocialCopyEditor
          isOpen={showSocialCopyEditor}
          onClose={() => {
            setShowSocialCopyEditor(false);
            // Restore scroll position when closing the editor
            setTimeout(() => {
              restoreScrollPosition();
            }, 100);
          }}
          onSave={(updatedCardData) => {
            setUpdatedCard(updatedCardData);
            setShowSocialCopyEditor(false);
            // Restore scroll position after saving
            setTimeout(() => {
              restoreScrollPosition();
            }, 100);
          }}
          cardId={id}
          initialInstagramCopy={localInstagramCopy || ''}
          initialFacebookCopy={localFacebookCopy || ''}
          initialActiveTab={activeSocialCopy?.type || 'instagram'}
        />
      )}

      <div className="p-4 flex-1 relative">
        {children}
        
        
        <div className="mt-3">
          <p className="text-gray-700 mb-2">{description}</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {tags.map((tag) => (
              <span 
                key={tag} 
                className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
      
      <div className="border-t border-gray-200 p-4 bg-gray-50 flex justify-between items-center">
        <div className="flex items-center space-x-3">
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
          
          {/* Social Copy Icons */}
          {instagramCopy && (
            <button 
              onClick={() => handleOpenSocialCopy('instagram')}
              className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
              title="View Instagram Copy"
              aria-label="View Instagram Copy"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4 fill-[#C13584]">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
              </svg>
            </button>
          )}
          
          {facebookCopy && (
            <button 
              onClick={() => handleOpenSocialCopy('facebook')}
              className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
              title="View Facebook Copy"
              aria-label="View Facebook Copy"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4 fill-[#1877F2]">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </button>
          )}
        </div>
        
        {isAdmin && (
          <div className="flex space-x-2">
            <button
              onClick={() => onEdit && id && onEdit(id)}
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
                  onDelete && id && onDelete(id);
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
  );
};

export default BaseCard;
