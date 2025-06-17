'use client';

import React, { useState, useRef } from 'react';
import Image from 'next/image';
import { ImageCardProps } from '../../types';
import BaseCard from './BaseCard';
import { useAuth } from '../../lib/authContext';
import { useCardGrid } from '../../contexts/CardGridContext';
import { trackCardDownload } from '../../lib/api';

const ImageCard: React.FC<ImageCardProps> = (props) => {
  // Don't destructure preview and download here since we need to pass them to BaseCard
  const { ...baseProps } = props;
  const { isAdmin } = useAuth();
  const { openLightbox } = useCardGrid();
  const [isDragging, setIsDragging] = useState(false);
  const imageRef = useRef<HTMLDivElement>(null);
  
  // Handle drag events
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!isAdmin) return;
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = () => {
    setIsDragging(false);
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (!isAdmin) return;
    e.preventDefault();
    setIsDragging(false);
    
    // Get the dropped files
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    
    // Check that files are images
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return;
    
    // Custom event for image drop
    const event = new CustomEvent('imagecard:imagedrop', {
      detail: {
        cardId: props.id,
        files: imageFiles
      }
    });
    
    // Dispatch the event to be handled by the parent component
    document.dispatchEvent(event);
  };

  // Handle image click to open lightbox
  const handleImageClick = (e: React.MouseEvent) => {
    // Don't open lightbox if clicking on admin drag/drop area
    if (isAdmin && isDragging) return;
    
    e.stopPropagation();
    const imageUrl = props.preview || props.download;
    if (imageUrl) {
      openLightbox(props.id, 0);
    }
  };


  return (
    <BaseCard {...baseProps} preview={props.preview} download={props.download}>
      <div className="relative group">
        <div 
          ref={imageRef}
          className={`w-full h-56 relative cursor-pointer ${isDragging ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleImageClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              const mouseEvent = e as unknown as React.MouseEvent;
              handleImageClick(mouseEvent);
            }
          }}
          aria-label="View image in lightbox"
        >
          {props.preview ? (
            <Image 
              src={props.preview}
              alt={props.description}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              priority
              draggable={false}
            />
          ) : (
            <>
              {/* If no preview, use download image or placeholder */}
              <div className="w-full h-full bg-blue-100 flex items-center justify-center">
                {props.download ? (
                  <Image
                    src={props.download}
                    alt={props.description}
                    fill
                    className="object-contain"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    priority
                    draggable={false}
                  />
                ) : (
                  <div className="text-xl font-bold text-blue-600">IMAGE</div>
                )}
              </div>
            </>
          )}
          
          {/* Drop zone indicator (only visible when dragging and admin) */}
          {isAdmin && isDragging && (
            <div className="absolute inset-0 bg-blue-100 bg-opacity-70 flex items-center justify-center z-10">
              <div className="bg-white p-3 rounded-lg shadow-md flex flex-col items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
                <span className="text-sm font-medium text-gray-700">Drop to replace image</span>
              </div>
            </div>
          )}
          
          {/* Download Icon Overlay - moved to top-right corner */}
          <a
            href={props.download}
            download={props.fileMetadata?.downloadOriginalFileName || undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-2 right-2 z-10"
            onClick={async (e) => {
              e.stopPropagation();
              try {
                await trackCardDownload(props.id);
              } catch (error) {
                console.error('Failed to track download:', error);
              }
            }}
            title={`Download ${props.fileMetadata?.downloadOriginalFileName || 'image'}`}
          >
            <div className="p-1.5 rounded-full bg-white bg-opacity-70 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
          </a>

          {/* Metadata Overlay */}
          {props.fileMetadata && (
            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white py-1.5 px-2 text-[0.65rem] flex flex-col font-medium">
              <div className="flex justify-between">
                <div>
                  {props.fileMetadata.width && props.fileMetadata.height &&
                    `${props.fileMetadata.width} × ${props.fileMetadata.height}`
                  }
                  {props.fileMetadata.fileSize &&
                    ` • ${props.fileMetadata.fileSize < 102400
                      ? `${(props.fileMetadata.fileSize / 1024).toFixed(1)}kb`
                      : `${(props.fileMetadata.fileSize / (1024 * 1024)).toFixed(1)}mb`}`
                  }
                </div>
                <div>
                  {props.fileMetadata.date &&
                    new Date(props.fileMetadata.date).toISOString().split('T')[0]
                  }
                </div>
              </div>
              {props.fileMetadata.downloadOriginalFileName && (
                <div className="text-xs mt-0.5 truncate text-gray-200">
                  {props.fileMetadata.downloadOriginalFileName}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </BaseCard>
  );
};

export default ImageCard;