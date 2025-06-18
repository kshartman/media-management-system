'use client';

import React, { useRef, useEffect, useState } from 'react';
import Image from 'next/image';
import { ReelCardProps } from '../../types';
import BaseCard from './BaseCard';
import { useVideoPlayer } from '../../contexts/VideoPlayerContext';
import { getProxiedImageUrl } from '../../lib/utils';
import { trackCardDownload, getDownloadUrl } from '../../lib/api';

const ReelCard: React.FC<ReelCardProps> = (props) => {
  // Keep all props to pass to BaseCard
  const { ...baseProps } = props;
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoId = `video-${props.id}`; // Use the card ID as the unique video ID
  
  // Detect Safari browser
  const isSafari = typeof window !== 'undefined' && 
    /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  
  // Get video context
  const { playVideo, isPlaying, registerVideoRef, stopAllVideos } = useVideoPlayer();
  
  // Register video ref when it's available
  useEffect(() => {
    if (videoRef.current) {
      registerVideoRef(videoId, videoRef.current);
    }
  }, [videoId, registerVideoRef]);


  const handlePlay = () => {
    playVideo(videoId);
    // Manually trigger play on the video element
    if (videoRef.current) {
      videoRef.current.play().catch(err => {
        console.log('Video play failed:', err);
      });
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      // Track the download
      await trackCardDownload(props.id);
      
      // Get signed download URL
      const response = await getDownloadUrl(
        getProxiedImageUrl(props.movie),
        props.fileMetadata?.movieOriginalFileName
      );
      
      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = response.downloadUrl;
      link.download = props.fileMetadata?.movieOriginalFileName || 'video.mp4';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Failed to download video:', error);
      // Fallback to direct link
      window.open(getProxiedImageUrl(props.movie), '_blank');
    }
  };

  return (
    <BaseCard 
      {...baseProps} 
      preview={props.preview} 
      movie={props.movie} 
      transcript={props.transcript} 
      instagramCopy={props.instagramCopy} 
      facebookCopy={props.facebookCopy}
    >
      <div className="relative group">
        {/* Safari: Simple video element with poster */}
        {isSafari ? (
          <div className="w-full aspect-[9/16] relative">
            <video
              ref={videoRef}
              poster={props.preview ? getProxiedImageUrl(props.preview) : undefined}
              controls
              preload="auto"
              playsInline
              width="100%"
              crossOrigin="anonymous"
              className="w-full h-full object-cover"
              style={{ aspectRatio: '9/16' }}
              onPlay={() => {
                // When Safari video starts playing, update context and stop other videos
                playVideo(videoId);
              }}
              onPause={() => {
                // When Safari video is paused, clear the playing state
                if (isPlaying(videoId)) {
                  playVideo("");
                }
              }}
              onError={(e) => {
                const videoElement = e.target as HTMLVideoElement;
                console.error('Video error:', e.type, videoElement?.error?.code, videoElement?.error?.message);
              }}
            >
              <source 
                src={getProxiedImageUrl(props.movie)}
                type="video/mp4"
              />
              <track kind="captions" srcLang="en" label="English" default />
              {props.transcript && (
                <track
                  kind="captions"
                  src={props.transcript}
                  label="English captions"
                  srcLang="en"
                />
              )}
              Your browser does not support the video tag.
            </video>
            
            {/* Download button overlay for Safari - positioned to avoid native controls */}
            <button
              className="absolute bottom-12 right-2 z-10"
              onClick={handleDownload}
              title={`Download ${props.fileMetadata?.movieOriginalFileName || 'video'}`}
            >
              <div className="p-1.5 rounded-full bg-white bg-opacity-90 transition-opacity duration-200">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
            </button>
            
            {/* Development download count for Safari - positioned to avoid native controls */}
            {process.env.NODE_ENV === 'development' && typeof props.downloadCount === 'number' && (
              <div className="absolute bottom-12 left-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded z-20">
                {props.downloadCount}
              </div>
            )}
          </div>
        ) : (
          /* Chrome and other browsers: Keep existing interactive behavior */
          <div 
            className="w-full aspect-[9/16] relative cursor-pointer" 
            onClick={handlePlay}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handlePlay();
              }
            }}
            aria-label="Play video"
          >
          {!isPlaying(videoId) ? (
            <>
              {props.preview ? (
                <Image 
                  src={getProxiedImageUrl(props.preview)}
                  alt={props.description}
                  fill
                  className="object-cover"
                  style={{ aspectRatio: '9/16' }}
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  priority
                />
              ) : (
                <div
                  className="w-full h-full bg-yellow-100 flex items-center justify-center"
                  aria-hidden="true"
                >
                  <div className="text-xl font-bold text-yellow-600">VIDEO</div>
                </div>
              )}
              
              {/* Development-only download count overlay */}
              {process.env.NODE_ENV === 'development' && typeof props.downloadCount === 'number' && (
                <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded z-20">
                  {props.downloadCount}
                </div>
              )}

              {/* Play button overlay */}
              <div 
                className="absolute inset-0 flex items-center justify-center cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation(); // Prevent double triggering
                  handlePlay();
                }}
                aria-hidden="true"
              >
                {/* Play button styled to match the provided image */}
                <div className="w-24 h-24 rounded-full bg-gray-800/30 flex items-center justify-center shadow-lg hover:bg-gray-800/50 transition-colors">
                  <div className="w-0 h-0 border-t-[20px] border-t-transparent border-l-[35px] border-l-white border-b-[20px] border-b-transparent ml-2.5"></div>
                </div>
              </div>
              
              {/* Download Icon Overlay */}
              <button
                className="absolute top-2 right-2 z-10"
                onClick={handleDownload}
                title={`Download ${props.fileMetadata?.movieOriginalFileName || 'video'}`}
              >
                <div className="p-1.5 rounded-full bg-white bg-opacity-70 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </div>
              </button>

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
            /* Video playing state for Chrome */
            <>
              <video
                ref={videoRef}
                controls
                autoPlay
                crossOrigin="anonymous"
                width="100%"
                preload="auto"
                muted={false}
                playsInline
                onEnded={() => playVideo("")}
                onError={(e) => {
                  const videoElement = e.target as HTMLVideoElement;
                  console.error('Video error:', e.type, videoElement?.error?.code, videoElement?.error?.message);
                }}
                aria-label={props.description || "Video content"}
                className="w-full h-full object-cover"
                style={{ aspectRatio: '9/16' }}
              >
                <source 
                  src={getProxiedImageUrl(props.movie)}
                  type="video/mp4"
                />
                <track kind="captions" srcLang="en" label="English" default />
                {props.transcript && (
                  <track
                    kind="captions"
                    src={props.transcript}
                    label="English captions"
                    srcLang="en"
                  />
                )}
                Your browser does not support the video tag.
              </video>
              
              {/* Close button when video is playing */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  playVideo(""); // Clear current playing video
                }}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors z-20"
                aria-label="Close video"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </>
          )}
          </div>
        )}
      </div>
    </BaseCard>
  );
};

export default ReelCard;