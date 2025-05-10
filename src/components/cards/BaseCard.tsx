'use client';

import React from 'react';
import { BaseCardProps } from '../../types';

const BaseCard: React.FC<React.PropsWithChildren<BaseCardProps>> = ({
  id,
  tags,
  description,
  children,
  onEdit,
  onDelete,
  isAdmin = false,
}) => {

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden flex flex-col h-full">
      <div className="p-4 flex-1">
        {children}
        
        <div className="mt-3">
          <p className="text-gray-700 mb-2">{description}</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {tags.map((tag) => (
              <span 
                key={tag} 
                className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
      
      <div className="border-t border-gray-200 p-4 bg-gray-50 flex justify-between items-center">
        <div>
          <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
            Download All
          </button>
        </div>
        
        {isAdmin && (
          <div className="flex space-x-2">
            <button 
              onClick={() => onEdit && onEdit(id)}
              className="text-gray-600 hover:text-gray-800"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </button>
            <button 
              onClick={() => onDelete && onDelete(id)}
              className="text-red-600 hover:text-red-800"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BaseCard;
