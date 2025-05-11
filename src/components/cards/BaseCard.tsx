'use client';

import React, { useState } from 'react';
import { BaseCardProps } from '../../types';
import JSZip from 'jszip';

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
  documentCopy,
  movie,
  transcript,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);

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
    console.log('Files available:', {
      preview,
      download,
      documentCopy,
      movie,
      transcript,
      fileMetadata
    });

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
        if (documentCopy) {
          const docName = fileMetadata?.documentCopyOriginalFileName || documentCopy.split('/').pop() || 'document.pdf';
          files.push({ url: documentCopy, name: docName });
        }
        // Only include preview if it exists
        if (preview) {
          const previewName = fileMetadata?.previewOriginalFileName || preview.split('/').pop() || 'preview.jpg';
          files.push({ url: preview, name: previewName });
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
      }

      if (files.length === 0) {
        console.error('No files available to download');
        return;
      }

      // No additional metadata files, as requested

      // Fetch all files and add them to the ZIP using our proxy API
      console.log('Fetching files for ZIP:', files);
      for (const file of files) {
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

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden flex flex-col h-full">
      <div className="p-4 flex-1">
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
        <div>
          <button
            onClick={handleDownloadAll}
            disabled={isDownloading}
            className={`text-sm font-medium flex items-center ${
              isDownloading
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-blue-600 hover:text-blue-800'
            }`}
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
                Download ZIP
              </>
            )}
          </button>
        </div>
        
        {isAdmin && (
          <div className="flex space-x-2">
            <button
              onClick={() => onEdit && id && onEdit(id)}
              className="text-gray-600 hover:text-gray-800"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </button>
            <button 
              onClick={() => onDelete && onDelete(id)}
              className="text-red-600 hover:text-red-800"
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
