'use client';

import { useState } from 'react';
import Image from 'next/image';
import Navigation from './Navigation';
import { useAuth } from '@/lib/authContext';

interface AppHeaderProps {
  title?: string;
  showControls?: boolean;
  controlsSlot?: React.ReactNode;
  onLoginClick?: () => void;
}

export default function AppHeader({ title = "Affiliate Resources", showControls = false, controlsSlot, onLoginClick }: AppHeaderProps) {
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const { isAdmin, logout } = useAuth();

  const handleLoginClick = () => {
    if (isAdmin) {
      logout();
    } else if (onLoginClick) {
      onLoginClick();
    } else {
      window.location.href = '/';
    }
  };

  return (
    <>
      <header className="bg-[#d9f2fc] border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3">
          {/* Top row with title, logo, and menu */}
          <div className="flex justify-between items-center relative">
            <div className="relative">
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="flex items-center justify-center w-10 h-10 text-gray-700 hover:text-gray-900 focus:outline-none"
                aria-label="Menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              
              {showMobileMenu && (
                <div className="absolute left-0 top-12 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                  <a
                    href="/help"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setShowMobileMenu(false)}
                  >
                    Help
                  </a>
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    onClick={() => {
                      handleLoginClick();
                      setShowMobileMenu(false);
                    }}
                    className="block w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 text-left"
                  >
                    {isAdmin ? 'Logout' : 'Admin Login'}
                  </button>
                  <a
                    href="https://affiliates.shopzive.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setShowMobileMenu(false)}
                  >
                    Affiliate Portal
                  </a>
                  <a
                    href="https://shopzive.com/pages/zivepro-affiliate-resources"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setShowMobileMenu(false)}
                  >
                    Affiliate Training
                  </a>
                </div>
              )}
            </div>

            <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center">
              <Image
                src="/zive-logo.png"
                alt="ZIVE logo"
                className="h-8 w-auto"
                width={96}
                height={32}
                priority
              />
            </div>

            <h1 className="text-xl font-bold text-gray-900 hidden sm:block">{title}</h1>
          </div>
          
          {/* Navigation row */}
          <div className="mt-3 flex justify-center">
            <Navigation />
          </div>
        </div>
      </header>

      {/* Controls section (for main page) */}
      {showControls && controlsSlot && (
        <div className="sticky top-[100px] z-30 bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-3">
            {controlsSlot}
          </div>
        </div>
      )}
    </>
  );
}