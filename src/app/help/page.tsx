'use client';

import React, { useState, useEffect } from 'react';
import HelpContent from '@/components/help/HelpContent';
import AppHeader from '@/components/layout/AppHeader';
import LoginForm from '@/components/auth/LoginForm';

export default function HelpPage() {
  const [showLoginModal, setShowLoginModal] = useState(false);

  const handleLoginClick = () => {
    setShowLoginModal(true);
  };

  const handleLoginSuccess = () => {
    setShowLoginModal(false);
  };

  // Body scroll locking effect for login modal
  useEffect(() => {
    if (!showLoginModal) return;

    // Store the original styles and scroll position
    const originalStyle = window.getComputedStyle(document.body).overflow;
    const scrollY = window.scrollY;
    
    // Store the scroll position value in local state for this component instance
    const scrollPosForThisModal = scrollY;
    
    // Lock body scroll and fix position
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.top = `-${scrollY}px`;
    document.documentElement.style.overflow = 'hidden';

    return () => {
      // Restore original style when component unmounts
      document.body.style.overflow = originalStyle;
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      document.documentElement.style.overflow = '';
      
      // Restore scroll position
      window.scrollTo(0, scrollPosForThisModal);
    };
  }, [showLoginModal]);

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader title="Help Resources" onLoginClick={handleLoginClick} />
      <HelpContent />

      {showLoginModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-auto">
          <div className="bg-white rounded-lg shadow-xl absolute left-1/2 transform -translate-x-1/2 w-full max-w-md px-4" style={{ top: '120px' }}>
            <div className="relative">
              <button
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
                onClick={() => setShowLoginModal(false)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <LoginForm onLoginSuccess={handleLoginSuccess} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}