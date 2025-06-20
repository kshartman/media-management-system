'use client';

import React, { useState, useRef, useEffect } from 'react';

export type SortOption = 'newest' | 'alphabetical' | 'popularity' | 'oldest';

interface SortDropdownProps {
  onSortChange: (sortBy: SortOption) => void;
  currentSort: SortOption;
}

const SortDropdown: React.FC<SortDropdownProps> = ({ onSortChange, currentSort }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const sortOptions = [
    { id: 'newest', label: 'Newest' },
    { id: 'alphabetical', label: 'Alphabetical' },
    { id: 'popularity', label: 'Popularity' },
    { id: 'oldest', label: 'Oldest' }
  ];

  const handleSortChange = (sortOption: SortOption) => {
    onSortChange(sortOption);
    setIsOpen(false);
  };

  // Get the current sort option label
  const getCurrentSortLabel = () => {
    const option = sortOptions.find(opt => opt.id === currentSort);
    return option ? option.label : 'Newest';
  };
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="w-44 relative" ref={dropdownRef}>
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-700 whitespace-nowrap hidden lg:inline">Sort:</span>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-700 text-sm flex items-center justify-between gap-2 whitespace-nowrap"
        >
          <span className="truncate">{getCurrentSortLabel()}</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="h-4 w-4 flex-shrink-0"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 8.25l-7.5 7.5-7.5-7.5"
            />
          </svg>
        </button>
      </div>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg z-50">
          {sortOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => handleSortChange(option.id as SortOption)}
              className={`
                w-full text-left px-4 py-2 text-sm hover:bg-gray-100
                ${
                  currentSort === option.id
                    ? 'bg-blue-50 text-blue-800'
                    : 'text-gray-700'
                }
              `}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SortDropdown;