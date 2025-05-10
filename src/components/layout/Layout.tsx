'use client';

import React, { ReactNode } from 'react';
import { useAuth } from '../../lib/authContext';

interface LayoutProps {
  children: ReactNode;
  title?: string;
  onLoginClick?: () => void;
  isAdmin?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  title = 'Media Management System',
  onLoginClick,
  isAdmin = false
}) => {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-md">
        <div className="mx-auto max-w-screen-xl px-4 py-4 flex items-center justify-between">
          <a
            href="#"
            className="text-xl font-bold text-gray-900"
          >
            {title}
          </a>
          
          <div className="flex items-center gap-4">
            {isAdmin ? (
              <button
                onClick={logout}
                className="text-sm text-gray-700 hover:text-gray-900 px-4 py-2 rounded"
              >
                Logout
              </button>
            ) : (
              <button
                onClick={onLoginClick}
                className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded hidden lg:inline-block"
              >
                Admin Login
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
};

export default Layout;