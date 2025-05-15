'use client';

import React, { useState, useRef, useEffect } from 'react';

interface TypeDropdownProps {
  onFilterChange: (filters: {
    type?: string[];
    tags?: string[];
    search?: string;
  }) => void;
  selectedTypes: string[];
}

const TypeDropdown: React.FC<TypeDropdownProps> = ({ onFilterChange, selectedTypes }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Make sure type IDs exactly match the database model's enum values 
  const typeOptions = [
    { id: 'all', label: 'All Types' },
    { id: 'image', label: 'Images' },
    { id: 'social', label: 'Posts' },
    { id: 'reel', label: 'Reels' }
  ];

  const handleTypeChange = (typeId: string) => {
    console.log('TypeDropdown: Selected type:', typeId);
    // If 'all' is selected, clear the type filter (empty array)
    const newTypes = typeId === 'all' ? [] : [typeId];
    console.log('TypeDropdown: Setting filter to:', newTypes);
    onFilterChange({ type: newTypes });
    setIsOpen(false);
  };

  // Determine current selection label
  const getCurrentSelectionLabel = () => {
    if (selectedTypes.length === 0) {
      return 'All Types';
    } else {
      const selectedType = typeOptions.find(type => type.id === selectedTypes[0]);
      return selectedType ? selectedType.label : 'All Types';
    }
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
    <div className="w-56 relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-700 flex items-center justify-between gap-2"
      >
        {getCurrentSelectionLabel()}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className="h-4 w-4"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 8.25l-7.5 7.5-7.5-7.5"
          />
        </svg>
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg z-10">
          {typeOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => handleTypeChange(option.id)}
              className={`
                w-full text-left px-4 py-2 text-sm hover:bg-gray-100
                ${
                  (option.id === 'all' && selectedTypes.length === 0) || 
                  selectedTypes.includes(option.id)
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

export default TypeDropdown;