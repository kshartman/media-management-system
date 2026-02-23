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

  // Show all tags, sorted alphabetically, filtered by search
  const filteredTags = availableTags
    .filter(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => a.localeCompare(b));

  const handleTagToggle = (tag: string) => {
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter(t => t !== tag)
      : [...selectedTags, tag];
    onFilterChange({ tags: newTags });
  };

  const handleClearAll = () => {
    onFilterChange({ tags: [] });
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
    <div className="w-32 relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-700 text-sm flex items-center justify-between gap-2 whitespace-nowrap"
      >
        <span className="truncate">
          Tags{selectedTags.length > 0 && ` (${selectedTags.length})`}
        </span>
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
        <div className="absolute top-full left-0 mt-1 min-w-full w-max max-w-64 bg-white border border-gray-200 rounded-md shadow-lg z-50">
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

          {selectedTags.length > 0 && (
            <button
              onClick={handleClearAll}
              className="w-full text-left px-4 py-1.5 text-xs text-blue-600 hover:bg-gray-50 border-b border-gray-100"
            >
              Clear all
            </button>
          )}

          <div className="max-h-60 overflow-y-auto">
            {filteredTags.length > 0 && (
              filteredTags.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => handleTagToggle(tag)}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 text-gray-700 flex items-center gap-2"
                  >
                    <span className={`w-4 h-4 flex-shrink-0 flex items-center justify-center rounded border ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300'}`}>
                      {isSelected && (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                    </span>
                    {tag}
                  </button>
                );
              })
            )}

            {filteredTags.length === 0 && !searchQuery && (
              <div className="px-4 py-2 text-sm text-gray-500">
                No tags available
              </div>
            )}

            {filteredTags.length === 0 && searchQuery && (
              <div className="px-4 py-2 text-sm text-gray-500">
                No matching tags
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TagDropdown;
