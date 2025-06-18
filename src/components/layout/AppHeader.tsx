'use client';

import { useState, useEffect, useRef } from 'react';
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
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { isAuthenticated, isAdmin, isEditor, user, logout } = useAuth();
  const userMenuRef = useRef<HTMLDivElement>(null);

  const handleLoginClick = () => {
    if (isAuthenticated) {
      logout();
    } else if (onLoginClick) {
      onLoginClick();
    } else {
      window.location.href = '/';
    }
  };

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <>
      <header className="bg-[#d9f2fc] border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:py-3" style={{paddingBottom: 'calc(0.75rem - 2px)'}}>
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
                  {isAuthenticated ? (
                    <button
                      onClick={() => {
                        logout();
                        setShowMobileMenu(false);
                      }}
                      className="block w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 text-left"
                    >
                      Logout
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (onLoginClick) {
                          onLoginClick();
                        }
                        setShowMobileMenu(false);
                      }}
                      className="block w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 text-left"
                    >
                      Login
                    </button>
                  )}
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

            <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center pointer-events-none">
              <Image
                src="/zive-logo.png"
                alt="ZIVE logo"
                className="h-8 w-auto"
                width={96}
                height={32}
                priority
              />
            </div>

            <div className="flex items-center">
              {/* User Avatar/Login - Always show avatar, on mobile becomes dropdown */}
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => {
                    if (isAuthenticated) {
                      setShowUserMenu(!showUserMenu);
                    } else {
                      // On desktop, show login directly
                      if (window.innerWidth >= 640) {
                        if (onLoginClick) {
                          onLoginClick();
                        }
                      } else {
                        // On mobile, show dropdown with login option
                        setShowUserMenu(!showUserMenu);
                      }
                    }
                  }}
                  className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-white hover:bg-opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {/* User Avatar */}
                  <div className="w-8 h-8 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  </div>
                  {/* Username - only show when authenticated */}
                  {isAuthenticated && user && (
                    <span className="hidden sm:block">{user.username}</span>
                  )}
                  {/* Login text - hide on small mobile screens when not authenticated */}
                  {!isAuthenticated && (
                    <span className="hidden min-[400px]:block sm:hidden">Login</span>
                  )}
                  {/* Dropdown Arrow - always show */}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                    {isAuthenticated && user ? (
                      <>
                        <div className="px-4 py-2 text-sm text-gray-900 border-b border-gray-100">
                          <div className="font-medium">{user.username}</div>
                          <div className="text-xs text-gray-500 capitalize">
                            {isAdmin ? (
                              <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-purple-100 text-purple-800 font-medium">
                                Admin
                              </span>
                            ) : isEditor ? (
                              <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800 font-medium">
                                Editor
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-800 font-medium">
                                User
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            logout();
                            setShowUserMenu(false);
                          }}
                          className="block w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 text-left"
                        >
                          Logout
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => {
                          if (onLoginClick) {
                            onLoginClick();
                          }
                          setShowUserMenu(false);
                        }}
                        className="block w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 text-left"
                      >
                        Login
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Navigation row */}
          <div className="mt-3 flex justify-center relative">
            <Navigation />
            {/* Page title positioned on the left, aligned with hamburger menu, hidden when space is crowded */}
            <h1 className="absolute left-0 top-1/2 transform -translate-y-1/2 text-xl font-bold text-gray-900 hidden lg:block">{title}</h1>
          </div>
          
        </div>
        
        {/* Controls section integrated into header - full width */}
        {showControls && controlsSlot && (
          <div className="bg-white pt-3 pb-3">
            <div className="max-w-7xl mx-auto px-4">
              {controlsSlot}
            </div>
          </div>
        )}
      </header>
    </>
  );
}