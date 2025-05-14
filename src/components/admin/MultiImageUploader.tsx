'use client';

import React, { useState, useRef, useEffect } from 'react';

interface MultiImageUploaderProps {
  initialImages?: string[];
  onChange: (files: File[]) => void;
  isSubmitting?: boolean;
}

const MultiImageUploader: React.FC<MultiImageUploaderProps> = ({ 
  initialImages = [], 
  onChange,
  isSubmitting = false
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  
  // Check for dropped files from the SocialCard component
  useEffect(() => {
    // Check if we have dropped files from a SocialCard
    if (window.droppedFiles && window.droppedFiles.length > 0) {
      try {
        // Convert to array if needed
        const filesArray = Array.from(window.droppedFiles);
        
        // Filter for valid image files
        const validFiles = filesArray.filter(file => {
          // Check file type
          const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
          if (!validTypes.includes(file.type)) {
            console.warn(`File ${file.name} is not a supported image type`);
            return false;
          }
          
          // Check file size (max 50MB per file)
          const maxSize = 50 * 1024 * 1024;
          if (file.size > maxSize) {
            console.warn(`File ${file.name} exceeds 50MB size limit`);
            return false;
          }
          
          return true;
        });
        
        if (validFiles.length > 0) {
          // Add new files to existing selection
          const newSelection = [...selectedFiles, ...validFiles];
          setSelectedFiles(newSelection);
          
          // Generate preview URLs for new files
          const newUrls = validFiles.map(file => URL.createObjectURL(file));
          setPreviewUrls(prev => [...prev, ...newUrls]);
          
          // Notify parent component
          onChange(newSelection);
        }
        
        // Clear the global variable
        delete window.droppedFiles;
      } catch (error) {
        console.error('Error processing dropped files:', error);
      }
    }
  }, [onChange, selectedFiles]);

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      // Convert FileList to array
      const filesArray = Array.from(e.target.files);
      
      // Check each file
      const validFiles = filesArray.filter(file => {
        // Check file type
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
        if (!validTypes.includes(file.type)) {
          alert(`File ${file.name} is not a supported image type`);
          return false;
        }
        
        // Check file size (max 50MB per file)
        const maxSize = 50 * 1024 * 1024;
        if (file.size > maxSize) {
          alert(`File ${file.name} exceeds 50MB size limit`);
          return false;
        }
        
        return true;
      });
      
      // Add new files to existing selection
      const newSelection = [...selectedFiles, ...validFiles];
      setSelectedFiles(newSelection);
      
      // Generate preview URLs for new files
      const newUrls = validFiles.map(file => URL.createObjectURL(file));
      setPreviewUrls(prev => [...prev, ...newUrls]);
      
      // Notify parent component
      onChange(newSelection);
    }
  };

  // Handle file removal
  const handleRemoveFile = (index: number) => {
    // Create new arrays without the removed file
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    
    // Revoke the old URL to prevent memory leaks
    URL.revokeObjectURL(previewUrls[index]);
    
    const newUrls = previewUrls.filter((_, i) => i !== index);
    
    setSelectedFiles(newFiles);
    setPreviewUrls(newUrls);
    
    // Notify parent component
    onChange(newFiles);
  };

  // Handle file drop on the drop zone
  const handleContainerDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleContainerDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleContainerDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only set dragging to false if we're leaving the container (not entering a child)
    if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDraggingOver(false);
    }
  };

  const handleContainerDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    
    // Check if files were dropped
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files);
      
      // Filter for valid image files
      const validFiles = filesArray.filter(file => {
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
        if (!validTypes.includes(file.type)) {
          alert(`File ${file.name} is not a supported image type`);
          return false;
        }
        
        // Check file size (max 50MB per file)
        const maxSize = 50 * 1024 * 1024;
        if (file.size > maxSize) {
          alert(`File ${file.name} exceeds 50MB size limit`);
          return false;
        }
        
        return true;
      });
      
      if (validFiles.length > 0) {
        // Add new files to existing selection
        const newSelection = [...selectedFiles, ...validFiles];
        setSelectedFiles(newSelection);
        
        // Generate preview URLs for new files
        const newUrls = validFiles.map(file => URL.createObjectURL(file));
        setPreviewUrls(prev => [...prev, ...newUrls]);
        
        // Notify parent component
        onChange(newSelection);
      }
    }
  };

  // Handle reordering with drag and drop
  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    // Check if this is a reordering operation (has text/plain data)
    if (e.dataTransfer.types.includes('text/plain')) {
      const dragIndex = parseInt(e.dataTransfer.getData('text/plain'));
      
      if (dragIndex === dropIndex) return;
      
      // Reorder the files
      const newFiles = [...selectedFiles];
      const newUrls = [...previewUrls];
      
      // Remove from original position
      const [draggedFile] = newFiles.splice(dragIndex, 1);
      const [draggedUrl] = newUrls.splice(dragIndex, 1);
      
      // Insert at new position
      newFiles.splice(dropIndex, 0, draggedFile);
      newUrls.splice(dropIndex, 0, draggedUrl);
      
      setSelectedFiles(newFiles);
      setPreviewUrls(newUrls);
      
      // Notify parent component
      onChange(newFiles);
    }
  };

  return (
    <div className="mb-4">
      <div className="font-medium mb-1 text-sm">
        Image Sequence (at least one image required)
      </div>
      
      {/* File input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.jpg,.jpeg,.png,.gif,.webp,.svg"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        disabled={isSubmitting}
      />
      
      {/* Custom button */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className={`px-4 py-2 bg-blue-50 border border-blue-200 rounded flex items-center gap-2 mb-3 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-100 transition-colors'}`}
        disabled={isSubmitting}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l-4 4m4-4v12" />
        </svg>
        <span>Add Images</span>
      </button>
      
      <div className="text-xs text-gray-500 mb-2">
        Drag images to reorder them in the sequence. First image will be used as preview if no preview image is provided.
      </div>
      
      {/* Preview area with drop zone */}
      <div
        ref={dropZoneRef}
        className={`rounded transition-all duration-300 relative ${isDraggingOver 
          ? 'bg-blue-100 border-2 border-dashed border-blue-500' 
          : selectedFiles.length > 0 
            ? 'border border-gray-200' 
            : 'border border-dashed border-gray-300 bg-gray-50'
        }`}
        onDragEnter={handleContainerDragEnter}
        onDragOver={handleContainerDragOver}
        onDragLeave={handleContainerDragLeave}
        onDrop={handleContainerDrop}
      >
        {isDraggingOver && (
          <div className="absolute inset-0 bg-blue-100 bg-opacity-70 flex items-center justify-center z-20 rounded pointer-events-none">
            <div className="text-center p-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-blue-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <div className="font-medium text-blue-700">Drop images here</div>
              <div className="text-sm text-blue-600 mt-1">Add to image sequence</div>
            </div>
          </div>
        )}
        
        {selectedFiles.length > 0 ? (
          <div className="flex flex-wrap gap-2 p-4 relative">
            {previewUrls.map((url, index) => (
              <div 
                key={`${url}-${index}`}
                className="relative w-20 h-20 border border-gray-200 rounded overflow-hidden cursor-move"
                draggable={!isSubmitting}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
              >
                <img 
                  src={url} 
                  alt={`Selected image ${index + 1}`} 
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveFile(index)}
                  className={`absolute top-0.5 right-0.5 bg-black bg-opacity-50 rounded-full p-0.5 text-white ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-opacity-70'}`}
                  title="Remove image"
                  disabled={isSubmitting}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white py-0.5 text-[0.6rem] text-center">
                  {index + 1}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center relative">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-500 mb-1">Drag & drop image files here</p>
            <p className="text-gray-400 text-sm">or use the Add Images button above</p>
          </div>
        )}
      </div>
      
      <div className="text-xs text-gray-500 mt-2">
        Supported formats: jpg, jpeg, png, gif, webp, svg (max 50MB per image)
      </div>
    </div>
  );
};

export default MultiImageUploader;