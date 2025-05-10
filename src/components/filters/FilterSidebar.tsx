'use client';

import React, { useState } from 'react';
import { debounce } from 'lodash';

interface FilterSidebarProps {
  tags: string[];
  onFilterChange: (filters: {
    type?: string[];
    tags?: string[];
    search?: string;
  }) => void;
}

const FilterSidebar: React.FC<FilterSidebarProps> = ({ tags, onFilterChange }) => {
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const debouncedSearch = debounce((term: string) => {
    applyFilters({ search: term });
  }, 300);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    debouncedSearch(term);
  };

  const handleTypeChange = (type: string) => {
    const updatedTypes = selectedTypes.includes(type)
      ? selectedTypes.filter(t => t !== type)
      : [...selectedTypes, type];
    
    setSelectedTypes(updatedTypes);
    applyFilters({ type: updatedTypes });
  };

  const handleTagChange = (tag: string) => {
    const updatedTags = selectedTags.includes(tag)
      ? selectedTags.filter(t => t !== tag)
      : [...selectedTags, tag];
    
    setSelectedTags(updatedTags);
    applyFilters({ tags: updatedTags });
  };

  const applyFilters = (changes: {
    type?: string[];
    tags?: string[];
    search?: string;
  }) => {
    onFilterChange({
      type: changes.type !== undefined ? changes.type : selectedTypes,
      tags: changes.tags !== undefined ? changes.tags : selectedTags,
      search: changes.search !== undefined ? changes.search : searchTerm,
    });
  };

  const clearFilters = () => {
    setSelectedTypes([]);
    setSelectedTags([]);
    setSearchTerm('');
    onFilterChange({ type: [], tags: [], search: '' });
  };

  return (
    <aside className="w-full lg:w-64 bg-white shadow-md rounded-lg p-4">
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Search</h3>
        <input
          type="text"
          placeholder="Search by description..."
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={searchTerm}
          onChange={handleSearchChange}
        />
      </div>
      
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Media Types</h3>
        <div className="space-y-2">
          {['image', 'social', 'reel'].map(type => (
            <label key={type} className="flex items-center">
              <input
                type="checkbox"
                checked={selectedTypes.includes(type)}
                onChange={() => handleTypeChange(type)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 capitalize">{type}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Tags</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {tags.map(tag => (
            <label key={tag} className="flex items-center">
              <input
                type="checkbox"
                checked={selectedTags.includes(tag)}
                onChange={() => handleTagChange(tag)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2">{tag}</span>
            </label>
          ))}
        </div>
      </div>

      <button
        onClick={clearFilters}
        className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded"
      >
        Clear Filters
      </button>
    </aside>
  );
};

export default FilterSidebar;
