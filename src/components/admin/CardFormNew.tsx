'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CardProps } from '../../types';
import { getAllTags } from '../../lib/api';

interface CardFormProps {
  initialData?: CardProps;
  onSubmit: (formData: FormData) => Promise<void>;
  onCancel: () => void;
  availableTags?: string[];
}

const CardFormNew: React.FC<CardFormProps> = ({ initialData, onSubmit, onCancel, availableTags = [] }) => {

  // Card type is fixed and cannot be changed after creation
  const type = initialData?.type || 'image';
  const [description, setDescription] = useState(initialData?.description || '');
  const [date, setDate] = useState<string>(
    initialData?.fileMetadata?.date
      ? new Date(initialData.fileMetadata.date).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
  );
  const [tags, setTags] = useState<string[]>(initialData?.tags || []);
  const [newTag, setNewTag] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, File | null | boolean>>({
    preview: null,
    download: null,
    documentCopy: null,
    movie: null,
    transcript: null,
    remove_preview: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // For tag autocomplete
  const [allAvailableTags, setAllAvailableTags] = useState<string[]>(availableTags);
  const [filteredTags, setFilteredTags] = useState<string[]>([]);
  const [isTagsDropdownOpen, setIsTagsDropdownOpen] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Connect the save button in the modal header to the form submit
  useEffect(() => {
    const saveButton = document.getElementById('modal-submit-button');
    const handleSaveClick = () => {
      if (formRef.current) {
        // Trigger form submission
        const submitEvent = new Event('submit', { cancelable: true, bubbles: true });
        formRef.current.dispatchEvent(submitEvent);
      }
    };

    if (saveButton) {
      saveButton.addEventListener('click', handleSaveClick);
      return () => {
        saveButton.removeEventListener('click', handleSaveClick);
      };
    }
  }, []);

  // Fetch available tags if not provided
  useEffect(() => {
    const initializeTags = async () => {
      try {
        if (availableTags && availableTags.length > 0) {
          setAllAvailableTags(availableTags);
        } else {
          const tags = await getAllTags();
          setAllAvailableTags(tags);
        }
      } catch (error) {
        console.error('Error initializing tags:', error);
      }
    };

    initializeTags();
  }, [availableTags]);

  // Filter tags for dropdown - only show tags not already selected
  useEffect(() => {
    if (newTag.trim() === '') {
      // If no input but dropdown is open, show all available tags not already selected
      if (isTagsDropdownOpen) {
        const availableTags = [...allAvailableTags]
          .filter(tag => tag && !tags.includes(tag))
          .sort((a, b) => a.localeCompare(b));

        setFilteredTags(availableTags);
      } else {
        setFilteredTags([]);
      }
      return;
    }

    // Filter tags by prefix that aren't already selected
    const availableTags = allAvailableTags.filter(tag => tag && !tags.includes(tag));
    const input = newTag.toLowerCase().trim();
    const prefixMatches = availableTags
      .filter(tag => tag.toLowerCase().startsWith(input))
      .sort((a, b) => a.localeCompare(b));

    setFilteredTags(prefixMatches);
  }, [newTag, allAvailableTags, tags, isTagsDropdownOpen]);

  // Set up the required fields based on card type
  const getRequiredFields = () => {
    const common = ['description'];
    const typeSpecific = {
      image: ['download'],
      social: ['documentCopy'],
      reel: ['movie', 'transcript'],
    };

    return [...common, ...typeSpecific[type]];
  };

  const validateForm = () => {
    const requiredFields = getRequiredFields();
    const newErrors: Record<string, string> = {};
    
    if (!description.trim()) {
      newErrors.description = 'Description is required';
    }
    
    if (tags.length === 0) {
      newErrors.tags = 'At least one tag is required';
    }
    
    // Validate required files based on card type
    requiredFields.forEach(field => {
      if (field !== 'description' && !uploadedFiles[field] && !initialData?.[field as keyof CardProps]) {
        newErrors[field] = `${field.charAt(0).toUpperCase() + field.slice(1)} is required`;
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFileChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];

      // Check file size (max 50MB)
      if (file.size > 50 * 1024 * 1024) {
        setErrors(prev => ({
          ...prev,
          [field]: 'File size exceeds 50MB limit'
        }));
        return;
      }

      setUploadedFiles(prev => ({
        ...prev,
        [field]: file,
      }));

      // Clear error for this field if it exists
      if (errors[field]) {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
      }
    }
  };

  const handleTagInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewTag(e.target.value);
    setIsTagsDropdownOpen(true);
  };

  const handleTagAdd = (tagToAdd?: string) => {
    const tagValue = tagToAdd || newTag.trim();

    if (tagValue && !tags.includes(tagValue)) {
      const updatedTags = [...tags, tagValue];
      setTags(updatedTags);
      setNewTag('');
      setIsTagsDropdownOpen(false);

      // Clear tag error if it exists
      if (errors.tags) {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.tags;
          return newErrors;
        });
      }

      // Focus back on the input
      if (tagInputRef.current) {
        tagInputRef.current.focus();
      }
    }
  };

  const handleTagDelete = (tagToDelete: string) => {
    const updatedTags = tags.filter(tag => tag !== tagToDelete);
    setTags(updatedTags);
  };

  // Handle click outside of the dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tagInputRef.current && !tagInputRef.current.contains(event.target as Node)) {
        setIsTagsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    // Dispatch event for the modal to show loading state
    document.dispatchEvent(new Event('form-submit-start'));

    try {
      const formData = new FormData();
      formData.append('type', type);
      formData.append('description', description);
      formData.append('date', date);
      formData.append('tags', tags.join(','));

      // Append files if they exist
      Object.entries(uploadedFiles).forEach(([field, value]) => {
        if (field.startsWith('remove_') && value === true) {
          // Handle removal flags
          const actualField = field.replace('remove_', '');
          formData.append(`remove_${actualField}`, 'true');
        } else if (value instanceof File) {
          formData.append(field, value);
        }
      });

      await onSubmit(formData);
    } catch (error) {
      console.error('Error submitting form:', error);
      setErrors(prev => ({
        ...prev,
        form: 'An error occurred while saving. Please try again.',
      }));
    } finally {
      setIsSubmitting(false);
      // Dispatch event for the modal to hide loading state
      document.dispatchEvent(new Event('form-submit-end'));
    }
  };

  const handleRemoveFile = (field: string) => () => {
    setUploadedFiles(prev => ({
      ...prev,
      [field]: null,
    }));

    // Set special flag for preview removal
    if (field === 'preview' && initialData?.[field]) {
      setUploadedFiles(prev => ({
        ...prev,
        [`remove_${field}`]: true,
      }));
    }
  };

  const handleFileInputClick = (fieldId: string) => (e: React.MouseEvent) => {
    // Prevent default button behavior
    e.preventDefault();
    // Programmatically click the hidden file input
    document.getElementById(fieldId)?.click();
  };

  const renderFileInput = (field: string, label: string, accept?: string, isOptional: boolean = false) => {
    const hasSelectedFile = uploadedFiles[field] instanceof File;
    const selectedFileName = hasSelectedFile ? (uploadedFiles[field] as File).name : '';
    const fileInputId = `${field}-input`;

    return (
      <div className="mb-4">
        <div className="font-medium mb-1 text-sm">
          {label.replace('Preview ', '').replace('Downloadable ', '').replace('Thumbnail ', '').replace('Video ', '').replace('Document ', '')} {isOptional && <span className="text-gray-500 text-xs">(Optional)</span>}
        </div>
        <div className="flex flex-col">
          {/* Hidden file input for native file dialog */}
          <input
            id={fileInputId}
            type="file"
            onChange={handleFileChange(field)}
            accept={accept || "*/*"}
            multiple={false}
            className="hidden" // Hide the native input
          />

          {/* Custom file input UI */}
          <div className="flex items-center">
            <button
              type="button"
              onClick={handleFileInputClick(fileInputId)}
              className="px-4 py-2 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span>Browse</span>
            </button>

            {hasSelectedFile ? (
              <div className="ml-3 flex items-center gap-2">
                <span className="text-sm text-blue-600 font-medium truncate max-w-xs">
                  {selectedFileName}
                </span>
                <button
                  type="button"
                  onClick={handleRemoveFile(field)}
                  className="text-red-500 hover:text-red-700"
                  title="Remove file"
                >
                  ✕
                </button>
              </div>
            ) : (
              initialData && initialData[field as keyof CardProps] && (
                <div className="ml-3 flex items-center gap-2">
                  <span className="text-sm text-blue-600 font-medium truncate max-w-xs">
                    {typeof initialData[field as keyof CardProps] === 'string' ?
                      (initialData[field as keyof CardProps] as string).split('/').pop() :
                      'File'
                    }
                  </span>
                  {isOptional && (
                    <button
                      type="button"
                      onClick={handleRemoveFile(field)}
                      className="text-red-500 hover:text-red-700"
                      title="Remove file"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )
            )}
          </div>

          <small className="text-gray-500 mt-1 text-xs">
            {field.includes('preview') || field.includes('download') ?
              'Supported formats: jpg, jpeg, png, gif, webp, svg' :
              field.includes('movie') || field.includes('video') ?
                'Supported formats: mp4, mov, avi, webm' :
                'Supported formats: pdf, txt, doc, docx, srt'
            }
          </small>
        </div>
        {errors[field] && (
          <div className="mt-1 text-sm text-red-500">
            {errors[field]}
          </div>
        )}
      </div>
    );
  };

  const renderCardTypeFields = () => {
    switch (type) {
      case 'image':
        return (
          <>
            {renderFileInput('preview', 'Preview Image', 'image/*,.jpg,.jpeg,.png,.gif,.webp,.svg', true)}
            {renderFileInput('download', 'Downloadable Image', 'image/*,.jpg,.jpeg,.png,.gif,.webp,.svg')}
          </>
        );
      case 'social':
        return (
          <>
            {renderFileInput('preview', 'Preview Image', 'image/*,.jpg,.jpeg,.png,.gif,.webp,.svg', true)}
            {renderFileInput('documentCopy', 'Document Copy', 'application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.txt,.pdf,.doc,.docx')}
          </>
        );
      case 'reel':
        return (
          <>
            {renderFileInput('preview', 'Thumbnail Image', 'image/*,.jpg,.jpeg,.png,.gif,.webp,.svg', true)}
            {renderFileInput('movie', 'Video File', 'video/*,.mp4,.mov,.avi,.webm')}
            {renderFileInput('transcript', 'Transcript', 'application/pdf,text/plain,.txt,.pdf,.srt')}
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div>
      {errors.form && (
        <div className="mb-4 p-4 bg-red-50 border border-red-400 text-red-700 rounded">
          {errors.form}
        </div>
      )}
      
      <form ref={formRef} onSubmit={handleSubmit}>
        {!initialData && (
          <div className="mb-4">
            <h3 className="text-base font-medium mb-2">Card Type</h3>
            <div className="flex gap-4">
              <div className="text-gray-700 py-1">Image</div>
            </div>
            <p className="text-xs text-gray-500 mt-1">Card type is fixed and cannot be changed after creation</p>
          </div>
        )}
        {initialData && (
          <div className="mb-4">
            <h3 className="text-base font-medium mb-2">Card Type</h3>
            <div className="flex gap-4">
              <div className="text-gray-700 py-1 font-medium">
                {type === 'image' ? 'Image' : type === 'social' ? 'Social' : 'Reel'}
              </div>
            </div>
          </div>
        )}
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={`w-full px-3 py-2 border rounded text-sm ${errors.description ? 'border-red-500' : 'border-gray-300'}`}
            rows={3}
          />
          {errors.description && (
            <div className="mt-1 text-sm text-red-500">
              {errors.description}
            </div>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1" htmlFor="date">
            Date
          </label>
          <input
            type="date"
            id="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
          />
        </div>
        
        <div className="mb-4">
          <h3 className="text-base font-medium mb-2">Tags</h3>
          <div className="relative">
            <div className="flex mb-2">
              <div className="relative w-full">
                <input
                  ref={tagInputRef}
                  type="text"
                  value={newTag}
                  onChange={handleTagInput}
                  placeholder="Type to search or add a new tag"
                  className="w-full mr-2 px-3 py-2 border border-gray-300 rounded text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleTagAdd();
                    } else if (e.key === 'Escape') {
                      setIsTagsDropdownOpen(false);
                    } else if (e.key === 'ArrowDown' && filteredTags.length > 0 && isTagsDropdownOpen) {
                      // Focus on first dropdown item
                      const dropdownList = document.getElementById('tags-dropdown');
                      if (dropdownList && dropdownList.firstChild) {
                        (dropdownList.firstChild as HTMLElement).focus();
                      }
                    }
                  }}
                  onFocus={() => {
                    // Show all available tags when focusing
                    setIsTagsDropdownOpen(true);
                  }}
                  autoComplete="off" // Prevent browser autocomplete from interfering
                />
                {isTagsDropdownOpen && (
                  <div
                    id="tags-dropdown"
                    className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto"
                  >
                    {filteredTags.length > 0 ? (
                      filteredTags.map((tag) => {
                        // Only highlight the prefix (since we're only doing prefix matching)
                        const lowerInput = newTag.toLowerCase().trim();

                        let tagDisplay;
                        if (lowerInput.length > 0) {
                          // Highlight just the prefix that matches
                          const prefixLength = lowerInput.length;
                          const prefix = tag.substring(0, prefixLength);
                          const rest = tag.substring(prefixLength);

                          tagDisplay = (
                            <>
                              <span className="font-bold text-blue-600">{prefix}</span>
                              {rest}
                            </>
                          );
                        } else {
                          tagDisplay = tag;
                        }

                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => handleTagAdd(tag)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                            tabIndex={0}
                          >
                            {tagDisplay}
                          </button>
                        );
                      })
                    ) : (
                      <div className="px-3 py-2 text-sm text-gray-500">
                        No matching tags. Type to create a new tag.
                      </div>
                    )}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleTagAdd()}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm whitespace-nowrap"
              >
                Add Tag
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => handleTagDelete(tag)}
                  className="ml-1.5 text-blue-600 hover:text-blue-800"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>

          {errors.tags && (
            <div className="mt-1 text-sm text-red-500">
              {errors.tags}
            </div>
          )}

          {tags.length === 0 && (
            <p className="text-xs text-gray-500 mt-1">Add at least one tag to categorize this card</p>
          )}
        </div>

        {renderCardTypeFields()}

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300"
          >
            {isSubmitting ? 'Saving...' : (initialData ? 'Update' : 'Create')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CardFormNew;