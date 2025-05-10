'use client';

import React from 'react';
import { AuthProvider } from '../lib/authContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}