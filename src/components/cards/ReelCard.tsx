'use client';

import React from 'react';
import Image from 'next/image';
import { ReelCardProps } from '../../types';
import BaseCard from './BaseCard';

const ReelCard: React.FC<ReelCardProps> = (props) => {
  // Keep all props to pass to BaseCard
  const { ...baseProps } = props;
  const [isPlaying, setIsPlaying] = React.useState(false);

  return (
    <BaseCard {...baseProps} preview={props.preview} movie={props.movie} transcript={props.transcript}>
      <div className="relative group">
        <div className="w-full aspect-[9/16] relative">
          {!isPlaying ? (
            <>
              {props.preview ? (
                <Image 
                  src={props.preview}
                  alt={props.description}
                  fill
                  className="object-cover cursor-pointer"
                  style={{ aspectRatio: '9/16' }}
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  priority
                  onClick={() => setIsPlaying(true)}
                />
              ) : (
                <div
                  className="w-full h-full bg-yellow-100 flex items-center justify-center cursor-pointer"
                  onClick={() => setIsPlaying(true)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setIsPlaying(true);
                    }
                  }}
                  aria-label="Play video"
                >
                  <div className="text-xl font-bold text-yellow-600">VIDEO</div>
                </div>
              )}
              
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
                href={props.movie}
                download={props.fileMetadata?.movieOriginalFileName || undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute top-2 right-2"
                onClick={(e) => e.stopPropagation()}
                title={`Download ${props.fileMetadata?.movieOriginalFileName || 'video'}`}
              >
                <div className="p-1.5 rounded-full bg-white bg-opacity-70 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </div>
              </a>

              {/* Metadata Overlay */}
              {props.fileMetadata && (
                <div
                  className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white py-1.5 px-2 text-[0.65rem] flex flex-col font-medium"
                  role="region"
                  aria-label="File metadata"
                >
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
                  {props.fileMetadata.movieOriginalFileName && (
                    <div className="text-xs mt-0.5 truncate text-gray-200">
                      {props.fileMetadata.movieOriginalFileName}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="w-full aspect-[9/16]">
              <video
                src={props.movie}
                controls
                autoPlay
                className="w-full h-full object-contain"
              >
                {/* Adding a track element to satisfy a11y requirements */}
                <track
                  kind="captions"
                  src={props.transcript || undefined}
                  label="English captions"
                  srcLang="en"
                />
              </video>
            </div>
          )}
        </div>
      </div>
    </BaseCard>
  );
};

export default ReelCard;