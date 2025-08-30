'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import ResetPasswordForm from '../../components/auth/ResetPasswordForm';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const tokenParam = searchParams?.get('token');
    if (!tokenParam) {
      router.push('/');
      return;
    }
    setToken(tokenParam);
  }, [searchParams, router]);

  const handleSuccess = () => {
    setSuccess(true);
    setTimeout(() => {
      router.push('/');
    }, 3000);
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

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-100 py-12 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Invalid Reset Link</h2>
          <p className="text-gray-600">The password reset link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-100 py-12 flex items-center justify-center">
        <div className="max-w-md mx-auto">
          <div className="bg-white shadow-lg rounded-lg overflow-hidden">
            <div className="bg-green-600 mb-4 py-8 flex items-center justify-center">
              <h2 className="text-2xl font-bold text-white">
                Password Reset Successfully
              </h2>
            </div>
            <div className="px-6 py-4 text-center">
              <p className="text-gray-600 mb-4">
                Your password has been reset successfully. You will be redirected to the login page in a few seconds.
              </p>
              <button
                onClick={() => router.push('/')}
                className="py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Go to Login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-12">
      <ResetPasswordForm token={token} onSuccess={handleSuccess} />
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-100 py-12 flex items-center justify-center">Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}