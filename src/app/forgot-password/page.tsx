'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ForgotPasswordForm from '../../components/auth/ForgotPasswordForm';

export default function ForgotPasswordPage() {
  const router = useRouter();

  const handleBackToLogin = () => {
    router.push('/');
  };

  // Handle Escape key to go back to login
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        router.push('/');
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-100 py-12">
      <ForgotPasswordForm onBackToLogin={handleBackToLogin} />
    </div>
  );
}