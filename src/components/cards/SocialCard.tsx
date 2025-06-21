'use client';

import React, { useState, memo } from 'react';
import Image from 'next/image';
import { SocialCardProps } from '../../types';
import BaseCard from './BaseCard';
import Lightbox from '../ui/Lightbox';
import { trackCardDownload } from '../../lib/api';

const SocialCard: React.FC<SocialCardProps> = memo((props) => {
  // Keep all props to pass to BaseCard
  const { ...baseProps } = props;
  
  // Local state
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Calculate total sequence size from metadata if available
  const totalSize = props.fileMetadata?.totalSequenceSize || 
    (props.fileMetadata?.imageSequenceFileSizes ? 
      props.fileMetadata.imageSequenceFileSizes.reduce((sum, size) => sum + size, 0) : 0);
  
  // Get display image (preview or first in sequence)
  const getDisplayImage = () => {
    if (props.preview) {
      return props.preview;
    }
    
    // If no preview, use the first image in the sequence
    return props.imageSequence && props.imageSequence.length > 0 
      ? props.imageSequence[0] 
      : null;
  };
  
  // Handle expand/fullscreen button click
  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLightboxOpen(true);
  };

  // Handle drag and drop for image uploads
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    // Get dropped files
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    // Filter for image files
    const imageFiles = files.filter(file => {
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
      return validTypes.includes(file.type);
    });

    if (imageFiles.length === 0) {
      alert('Please drop only image files.');
      return;
    }

    // Dispatch custom event with the files
    const uploadEvent = new CustomEvent('socialcard:imagedrop', {
      detail: { cardId: props.id, files: imageFiles },
      bubbles: true
    });
    document.dispatchEvent(uploadEvent);
  };

  return (
    <BaseCard 
      {...baseProps} 
      preview={props.preview} 
      transcript={props.transcript} 
      imageSequence={props.imageSequence} 
      instagramCopy={props.instagramCopy} 
      facebookCopy={props.facebookCopy}
    >
      {/* Lightbox Component */}
      {props.imageSequence && props.imageSequence.length > 0 && (
        <Lightbox
          images={props.imageSequence}
          isOpen={lightboxOpen}
          onClose={() => {
            setLightboxOpen(false);
          }}
          initialIndex={0}
          autoPlay={true}
          interval={5000}
          imageMetadata={{
            names: props.fileMetadata?.imageSequenceOriginalFileNames || [],
            captions: props.fileMetadata?.imageSequenceCaptions || []
          }}
          cardId={props.id}
        />
      )}
      <div className="relative group">
        <div 
          className={`w-full h-56 relative cursor-pointer ${isDraggingOver ? 'ring-2 ring-blue-500 bg-blue-50 bg-opacity-40' : ''}`}
          onClick={() => setLightboxOpen(true)}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setLightboxOpen(true);
            }
          }}
          aria-label="View slideshow"
        >
          {getDisplayImage() ? (
            <Image 
              src={getDisplayImage() as string}
              alt={props.description}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              priority
            />
          ) : (
            <div className="w-full h-full bg-red-100 flex items-center justify-center">
              <div className="text-xl font-bold text-red-600">NO IMAGES</div>
            </div>
          )}
          
          {/* Development-only download count overlay */}
          {process.env.NODE_ENV === 'development' && typeof props.downloadCount === 'number' && (
            <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded z-20">
              {props.downloadCount}
            </div>
          )}

          {/* View slideshow button overlay */}
          {props.imageSequence && props.imageSequence.length > 0 && (
            <div 
              className="absolute inset-0 flex items-center justify-center"
              aria-hidden="true"
            >
              {/* Play button styled like the reel card */}
              <div className="w-16 h-16 rounded-full bg-gray-500/50 flex items-center justify-center shadow-lg hover:bg-gray-500/60 transition-colors">
                <div className="w-0 h-0 border-t-[14px] border-t-transparent border-l-[24px] border-l-white border-b-[14px] border-b-transparent ml-1.5"></div>
              </div>
            </div>
          )}
          
          {/* Image sequence indicator */}
          {props.imageSequence && props.imageSequence.length > 1 && (
            <div className="absolute bottom-12 left-0 right-0 flex justify-center">
              <div className="bg-black/50 rounded-full px-3 py-1 text-white text-xs">
                {props.imageSequence.length} images
              </div>
            </div>
          )}
          
          {/* Drag and drop overlay (only show when dragging over) */}
          {isDraggingOver && (
            <div className="absolute inset-0 bg-blue-100 bg-opacity-70 flex items-center justify-center z-20 border-2 border-dashed border-blue-500 rounded-md">
              <div className="text-center p-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto text-blue-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <div className="font-medium text-blue-700">Drop images here</div>
                <div className="text-xs text-blue-600 mt-1">Add to image sequence</div>
              </div>
            </div>
          )}

          {/* Expand, Document Download, and Transcript Icon Overlays */}
          <div className="absolute top-2 right-2 z-10 flex flex-col gap-2">              
            {/* Fullscreen/Expand button (only show if there are images) */}
            {props.imageSequence && props.imageSequence.length > 0 && (
              <button
                onClick={handleExpandClick}
                className="p-1.5 rounded-full bg-white bg-opacity-70 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200"
                title="View fullscreen"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                </svg>
              </button>
            )}
            
            {/* Transcript Icon */}
            {props.transcript && (
              <a
                href={props.transcript}
                download={props.fileMetadata?.transcriptOriginalFileName || undefined}
                target="_blank"
                rel="noopener noreferrer"
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    await trackCardDownload(props.id);
                  } catch (error) {
                    console.error('Failed to track download:', error);
                  }
                }}
                title={`Download ${props.fileMetadata?.transcriptOriginalFileName || 'transcript'}`}
              >
                <div className="p-1.5 rounded-full bg-white bg-opacity-70 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </a>
            )}
          </div>

          {/* Metadata Overlay */}
          {props.fileMetadata && (
            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white py-1.5 px-2 text-[0.65rem] flex flex-col font-medium">
              <div className="flex justify-between">
                <div>
                  {props.imageSequence && props.imageSequence.length > 0 && (
                    <span className="mr-2">{props.imageSequence.length} image{props.imageSequence.length > 1 ? 's' : ''}</span>
                  )}
                  {totalSize > 0 &&
                    `${totalSize < 102400
                      ? `${(totalSize / 1024).toFixed(1)}kb`
                      : `${(totalSize / (1024 * 1024)).toFixed(1)}mb`}`
                  }
                </div>
                <div>
                  {props.fileMetadata.date &&
                    new Date(props.fileMetadata.date).toISOString().split('T')[0]
                  }
                </div>
              </div>
              {props.fileMetadata.imageSequenceOriginalFileNames && props.fileMetadata.imageSequenceOriginalFileNames.length > 0 && (
                <div className="text-xs mt-0.5 truncate text-gray-200">
                  {props.fileMetadata.imageSequenceOriginalFileNames[0]}
                  {props.fileMetadata.imageSequenceOriginalFileNames.length > 1 ? ` (+${props.fileMetadata.imageSequenceOriginalFileNames.length - 1} more)` : ''}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </BaseCard>
  );
});

SocialCard.displayName = 'SocialCard';

export default SocialCard;