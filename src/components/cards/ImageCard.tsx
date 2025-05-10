'use client';

import React from 'react';
import Image from 'next/image';
import { ImageCardProps } from '../../types';
import BaseCard from './BaseCard';

const ImageCard: React.FC<ImageCardProps> = (props) => {
  const { preview, download, ...baseProps } = props;

  return (
    <BaseCard {...baseProps}>
      <div className="relative group">
        <div className="w-full h-56 relative">
          {preview ? (
            <Image 
              src={preview}
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
                {download ? (
                  <Image
                    src={download}
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
            href={download}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 hover:bg-opacity-30 transition-opacity duration-200"
          >
            <div className="p-1.5 rounded-full bg-white bg-opacity-70 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
          </a>
        </div>
      </div>
    </BaseCard>
  );
};

export default ImageCard;