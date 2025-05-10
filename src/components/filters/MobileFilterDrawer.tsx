'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import FilterSidebar from './FilterSidebar';

interface MobileFilterDrawerProps {
  tags: string[];
  onFilterChange: (filters: {
    type?: string[];
    tags?: string[];
    search?: string;
  }) => void;
}

const MobileFilterDrawer: React.FC<MobileFilterDrawerProps> = ({ tags, onFilterChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  // Close drawer on route change
  useEffect(() => {
    const handleRouteChange = () => {
      setIsOpen(false);
    };

    router.events.on('routeChangeComplete', handleRouteChange);

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router]);

  const toggleDrawer = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="lg:hidden">
      <button
        onClick={toggleDrawer}
        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md shadow"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
        </svg>
        Filters
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={toggleDrawer}></div>
          
          <div className="absolute inset-y-0 left-0 max-w-full flex">
            <div className="relative w-screen max-w-xs">
              <div className="h-full flex flex-col bg-white shadow-xl">
                <div className="flex items-center justify-between p-4 border-b">
                  <h2 className="text-lg font-medium">Filters</h2>
                  <button onClick={toggleDrawer} className="text-gray-500 hover:text-gray-700">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4">
                  <FilterSidebar tags={tags} onFilterChange={onFilterChange} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileFilterDrawer;
