'use client';

import React from 'react';
import { AuthProvider } from '../lib/authContext';
import { VideoPlayerProvider } from '../contexts/VideoPlayerContext';
import { SocialSlideProvider } from '../contexts/SocialSlideContext';
import { LightboxProvider } from '../contexts/LightboxContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <VideoPlayerProvider>
        <SocialSlideProvider>
          <LightboxProvider>
            {children}
          </LightboxProvider>
        </SocialSlideProvider>
      </VideoPlayerProvider>
    </AuthProvider>
  );
}