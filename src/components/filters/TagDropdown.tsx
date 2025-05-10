'use client';

import React, { useState, useRef, useEffect } from 'react';

interface TagDropdownProps {
  onFilterChange: (filters: {
    tags?: string[];
  }) => void;
  selectedTags: string[];
  availableTags: string[];
}

const TagDropdown: React.FC<TagDropdownProps> = ({ onFilterChange, selectedTags, availableTags }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Filter available tags based on search query and exclude already selected tags
  const filteredTags = availableTags
    .filter(tag => !selectedTags.includes(tag))
    .filter(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => a.localeCompare(b));

  const handleTagSelect = (tag: string) => {
    const newTags = [...selectedTags, tag];
    onFilterChange({ tags: newTags });
    setSearchQuery('');
    // Keep the dropdown open after selection
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // This function is used by the parent component directly
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleTagRemove = (tagToRemove: string) => {
    const newTags = selectedTags.filter(tag => tag !== tagToRemove);
    onFilterChange({ tags: newTags });
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

  // Focus the input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  return (
    <div className="w-56 relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-700 flex items-center justify-between gap-2 whitespace-nowrap"
      >
        <span className="truncate">Tags</span>
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
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg z-10">
          <div className="p-2">
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tags..."
              className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="max-h-60 overflow-y-auto">
            {filteredTags.length > 0 ? (
              filteredTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleTagSelect(tag)}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 text-gray-700"
                >
                  {tag}
                </button>
              ))
            ) : (
              <div className="px-4 py-2 text-sm text-gray-500">
                {searchQuery ? "No matching tags found" : "No tags available"}
              </div>
            )}
          </div>
        </div>
      )}

      {/* We'll move the selected tags display to the page component */}
    </div>
  );
};

export default TagDropdown;