'use client';

import React from 'react';
import Image from 'next/image';
import { ImageCardProps } from '../../types';
import BaseCard from './BaseCard';

const ImageCard: React.FC<ImageCardProps> = (props) => {
  // Don't destructure preview and download here since we need to pass them to BaseCard
  const { ...baseProps } = props;

  return (
    <BaseCard {...baseProps} preview={props.preview} download={props.download}>
      <div className="relative group">
        <div className="w-full h-56 relative">
          {props.preview ? (
            <Image 
              src={props.preview}
              alt={props.description}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              priority
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
                  />
                ) : (
                  <div className="text-xl font-bold text-blue-600">IMAGE</div>
                )}
              </div>
            </>
          )}
          
          {/* Download Icon Overlay */}
          <a
            href={props.download}
            download={props.fileMetadata?.downloadOriginalFileName || undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 hover:bg-opacity-30 transition-opacity duration-200"
            title={`Download ${props.fileMetadata?.downloadOriginalFileName || 'image'}`}
          >
            <div className="p-1.5 rounded-full bg-white bg-opacity-70 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
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