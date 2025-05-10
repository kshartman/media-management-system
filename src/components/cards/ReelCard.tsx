'use client';

import React from 'react';
import Image from 'next/image';
import { ReelCardProps } from '../../types';

const ReelCard: React.FC<ReelCardProps> = (props) => {
  const { preview, movie, transcript, ...baseProps } = props;
  const [isPlaying, setIsPlaying] = React.useState(false);
  
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="relative group">
        <div className="w-full h-56 relative">
          {!isPlaying ? (
            <>
              <Image 
                src={preview}
                alt={props.description}
                fill
                className="object-cover cursor-pointer"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                priority
                onClick={() => setIsPlaying(true)}
              />
              
              {/* Play button overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="p-3 rounded-full bg-white/70 shadow-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              
              {/* Download Icon Overlay */}
              <a 
                href={movie}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="absolute top-2 right-2"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-1.5 rounded-full bg-white bg-opacity-70 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </div>
              </a>
            </>
          ) : (
            <div className="h-full w-full">
              <video 
                src={movie} 
                controls 
                autoPlay
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>
      </div>
      
      <div className="p-3">
        <p className="text-sm text-gray-700 truncate font-medium">{props.description}</p>
        
        <div className="flex flex-wrap gap-1 mt-2">
          {baseProps.tags.map((tag) => (
            <span 
              key={tag} 
              className="inline-block bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ReelCard;
