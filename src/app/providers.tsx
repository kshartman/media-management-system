'use client';

import React from 'react';
import { AuthProvider } from '../lib/authContext';
import { VideoPlayerProvider } from '../contexts/VideoPlayerContext';
import { SocialSlideProvider } from '../contexts/SocialSlideContext';
import { ScrollProvider } from '../contexts/ScrollContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <VideoPlayerProvider>
        <SocialSlideProvider>
          <ScrollProvider>
            {children}
          </ScrollProvider>
        </SocialSlideProvider>
      </VideoPlayerProvider>
    </AuthProvider>
  );
}