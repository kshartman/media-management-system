'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CardProps } from '../../types';
import { getAllTags } from '../../lib/api';
import MultiImageUploader from './MultiImageUploader';


interface CardFormProps {
  initialData?: CardProps;
  initialCardType?: string;
  onSubmit: (formData: FormData) => Promise<void>;
  onCancel: () => void;
  availableTags?: string[];
  isSubmitting?: boolean;
}

const CardFormNew: React.FC<CardFormProps> = ({ 
  initialData, 
  initialCardType = 'image', 
  onSubmit, 
  onCancel, 
  availableTags = [],
  isSubmitting = false 
}) => {

  // Card type is fixed and cannot be changed after creation
  const type = initialData?.type || initialCardType;
  console.log('CardFormNew initialized with type:', type, 'initialCardType:', initialCardType);
  const [description, setDescription] = useState(initialData?.description || '');
  
  // For handling date input with proper formatting
  // Format initial date in MM/DD/YYYY format
  const formatDateMMDDYYYY = (dateStr: string | Date): string => {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return ''; // Invalid date
    }
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  // Initial date value formatted as MM/DD/YYYY
  const initialFormattedDate = initialData?.fileMetadata?.date
    ? formatDateMMDDYYYY(initialData.fileMetadata.date)
    : formatDateMMDDYYYY(new Date());

  const [date, setDate] = useState<string>(initialFormattedDate);
  // Track if date has been modified to handle Enter key behavior
  const [isDateModified, setIsDateModified] = useState<boolean>(false);
  
  // Helper to reset date to today's date
  const resetToToday = () => {
    setDate(formatDateMMDDYYYY(new Date()));
    setIsDateModified(false);
  };
  
  // Helper to parse and format date input
  const parseAndFormatDate = (inputDate: string): string => {
    try {
      // Handle various date formats (MM/DD/YYYY, YYYY-MM-DD, MM-DD-YYYY, etc.)
      const rawInput = inputDate.trim();
      
      // Direct 4-digit year input - handle specially
      if (/^\d{4}$/.test(rawInput)) {
        const year = parseInt(rawInput, 10);
        if (year >= 1900 && year <= 2100) {
          // Use current month and day with specified year
          const today = new Date();
          const month = today.getMonth() + 1;
          const day = today.getDate();
          return `${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}/${year}`;
        } else {
          // Invalid year, return today's date
          return formatDateMMDDYYYY(new Date());
        }
      }
      
      // Try to parse various formats
      let dateObj;
      
      // Check if it already matches our target format (MM/DD/YYYY)
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(rawInput)) {
        const [month, day, year] = rawInput.split('/').map(part => parseInt(part, 10));
        dateObj = new Date(year, month - 1, day);
      }
      // ISO format (YYYY-MM-DD)
      else if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(rawInput)) {
        dateObj = new Date(rawInput);
      }
      // MM-DD-YYYY
      else if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(rawInput)) {
        const [month, day, year] = rawInput.split('-').map(part => parseInt(part, 10));
        dateObj = new Date(year, month - 1, day);
      }
      // All other formats - try JavaScript Date parsing
      else {
        dateObj = new Date(rawInput);
      }
      
      // Validate the parsed date
      if (!isNaN(dateObj.getTime())) {
        const year = dateObj.getFullYear();
        // Validate year range
        if (year >= 1900 && year <= 2100) {
          // Format as MM/DD/YYYY
          const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
          const day = dateObj.getDate().toString().padStart(2, '0');
          return `${month}/${day}/${year}`;
        }
      }
      
      // If all validation fails, return today's date
      return formatDateMMDDYYYY(new Date());
    } catch (error) {
      console.error("Error parsing date:", error);
      // If parsing fails, return today's date
      return formatDateMMDDYYYY(new Date());
    }
  };
  const [tags, setTags] = useState<string[]>(initialData?.tags || []);
  const [newTag, setNewTag] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, File | null | boolean | File[]>>({
    preview: null,
    download: null,
    movie: null,
    transcript: null,
    remove_preview: false,
    imageSequence: [],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // For tag autocomplete
  const [allAvailableTags, setAllAvailableTags] = useState<string[]>(availableTags);
  const [filteredTags, setFilteredTags] = useState<string[]>([]);
  const [isTagsDropdownOpen, setIsTagsDropdownOpen] = useState(false);
  const [selectedTagIndex, setSelectedTagIndex] = useState(-1); // Track selected tag in dropdown
  const tagInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Connect the save button in the modal header to the form submit
  useEffect(() => {
    const saveButton = document.getElementById('modal-submit-button');
    const handleSaveClick = () => {
      if (formRef.current) {
        // If form is already submitting, don't trigger another submission
        if (isSubmitting) return;
        
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
  }, [isSubmitting]);

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
      social: ['imageSequence'], // Now requires imageSequence instead of documentCopy
      reel: ['movie'], // Transcript is now optional for reel cards
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
      if (field !== 'description') {
        if (field === 'imageSequence') {
          // For imageSequence, check if the array is empty
          const sequenceFiles = uploadedFiles[field] as File[];
          if (!sequenceFiles || sequenceFiles.length === 0) {
            // New card - always require at least one image
            if (!initialData) {
              newErrors[field] = 'At least one image in the sequence is required';
            } 
            // Editing existing card - only show error if there are no images
            else if (!initialData?.imageSequence || initialData.imageSequence.length === 0) {
              newErrors[field] = 'At least one image in the sequence is required';
            }
            // If we're editing a card that already has images, allow submission without new images
          }
        } else if (!uploadedFiles[field] && !initialData?.[field as keyof CardProps]) {
          newErrors[field] = `${field.charAt(0).toUpperCase() + field.slice(1)} is required`;
        }
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFileChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];

      // Check file size (max 500MB)
      const maxSize = 500 * 1024 * 1024; // 500MB
      if (file.size > maxSize) {
        setErrors(prev => ({
          ...prev,
          [field]: 'File size exceeds 500MB limit'
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
    // Only show dropdown if there's input
    if (e.target.value.trim() !== '') {
      setIsTagsDropdownOpen(true);
    }
    // Reset selected index whenever input changes
    setSelectedTagIndex(-1);
  };

  const handleTagAdd = (tagToAdd?: string) => {
    // Important: If a tag is explicitly passed (from dropdown selection),
    // use it directly instead of using the current input value
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

    // Double-check submission state to prevent multiple submissions
    if (!validateForm() || isSubmitting) {
      console.log('Form validation failed or already submitting, aborting submission');
      return;
    }

    // Dispatch event for the modal to show loading state
    console.log('Starting form submission, dispatching form-submit-start event');
    document.dispatchEvent(new Event('form-submit-start'));

    try {
      const formData = new FormData();
      console.log('Submitting form with type:', type);
      formData.append('type', type);
      formData.append('description', description);
      
      // Convert MM/DD/YYYY to YYYY-MM-DD for server storage
      try {
        if (date) {
          const parts = date.split('/');
          if (parts.length === 3) {
            const month = parts[0].padStart(2, '0');
            const day = parts[1].padStart(2, '0');
            const year = parts[2];
            // Store as YYYY-MM-DD for the server
            formData.append('date', `${year}-${month}-${day}`);
          } else {
            // Fallback if date is not in expected format
            formData.append('date', new Date().toISOString().split('T')[0]);
          }
        } else {
          // No date provided, use today
          formData.append('date', new Date().toISOString().split('T')[0]);
        }
      } catch (error) {
        console.error("Error formatting date for submission:", error);
        // Fallback to today's date
        formData.append('date', new Date().toISOString().split('T')[0]);
      }
      
      formData.append('tags', tags.join(','));

      // Append files and removal flags
      Object.entries(uploadedFiles).forEach(([field, value]) => {
        console.log(`Processing field: ${field}, value:`, value);

        if (field.startsWith('remove_') && value === true) {
          // Handle removal flags
          const actualField = field.replace('remove_', '');
          console.log(`Adding remove flag for ${actualField}`);
          formData.append(`remove_${actualField}`, 'true');
        } else if (field === 'imageSequence' && Array.isArray(value)) {
          // Handle image sequence files
          console.log(`Appending ${value.length} files for image sequence`);
          value.forEach((file, index) => {
            formData.append(`imageSequence_${index}`, file);
          });
          // Add the count so the server knows how many files to process
          formData.append('imageSequenceCount', value.length.toString());
        } else if (value instanceof File) {
          console.log(`Appending file for ${field}`);
          formData.append(field, value);
        }
      });

      await onSubmit(formData);
    } catch (error) {
      console.error('Error submitting form:', error);
      
      // Get the error message from the error
      let errorMessage = 'An error occurred while saving. Please try again.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setErrors(prev => ({
        ...prev,
        form: errorMessage,
      }));
      
      // Dispatch event for the modal to handle the error
      const errorEvent = new CustomEvent('form-submit-error', { 
        detail: errorMessage 
      });
      document.dispatchEvent(errorEvent);
      
      // Also dispatch the normal end event to hide loading state
      document.dispatchEvent(new Event('form-submit-end'));
    } finally {
      // This ensures the loading state is always cleared
      setTimeout(() => {
        document.dispatchEvent(new Event('form-submit-end'));
      }, 500);
    }
  };

  const handleRemoveFile = (field: string) => () => {
    console.log(`Removing file ${field}`, initialData?.[field as keyof CardProps]);

    // First set the field to null
    setUploadedFiles(prev => {
      console.log('Previous uploadedFiles state:', prev);
      return {
        ...prev,
        [field]: null,
      };
    });

    // Then, in a separate update, set the remove flag
    // This needs to be done for all existing files, not just preview
    if (initialData?.[field as keyof CardProps]) {
      setUploadedFiles(prev => {
        console.log(`Setting remove_${field} flag to true for ${field}:`, initialData[field as keyof CardProps]);
        const result = {
          ...prev,
          [`remove_${field}`]: true,
        };
        console.log('Updated uploadedFiles state will be:', result);
        return result;
      });
    }

    // Clear any errors for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
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
              onClick={isSubmitting ? undefined : handleFileInputClick(fileInputId)}
              className={`px-4 py-2 bg-blue-50 border border-blue-200 rounded flex items-center gap-2 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-100 transition-colors'}`}
              disabled={isSubmitting}
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
                  onClick={isSubmitting ? undefined : handleRemoveFile(field)}
                  className={`text-red-500 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:text-red-700'}`}
                  title="Remove file"
                  disabled={isSubmitting}
                >
                  ✕
                </button>
              </div>
            ) : uploadedFiles[`remove_${field}`] === true ? (
              // Show removed state when a file has been marked for removal
              <div className="ml-3 flex items-center gap-2">
                <span className="text-sm text-gray-500 italic truncate max-w-xs">
                  (File will be removed)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    // Allow undoing the removal
                    setUploadedFiles(prev => ({
                      ...prev,
                      [`remove_${field}`]: false
                    }));
                  }}
                  className="text-blue-500 hover:text-blue-700"
                  title="Undo removal"
                >
                  ↺
                </button>
              </div>
            ) : (
              initialData && initialData[field as keyof CardProps] && (
                <div className="ml-3 flex items-center gap-2">
                  <span className="text-sm text-blue-600 font-medium truncate max-w-xs">
                    {initialData.fileMetadata && initialData.fileMetadata[`${field}OriginalFileName` as keyof typeof initialData.fileMetadata] ?
                      initialData.fileMetadata[`${field}OriginalFileName` as keyof typeof initialData.fileMetadata] as string :
                      typeof initialData[field as keyof CardProps] === 'string' ?
                        (initialData[field as keyof CardProps] as string).split('/').pop() :
                        'File'
                    }
                  </span>
                  {/* Always allow removal if the file is optional or if we aren't editing an existing card */}
                  {(isOptional || !initialData) && (
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
                'Supported formats: mp4, mov, avi, webm (up to 500MB)' :
                field === 'transcript' ?
                  'Supported formats: txt, srt, pdf, docx, Pages, Google Docs - For transcriptions, subtitles, or dialogue text' :
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
            {renderFileInput('preview', 'Preview Image (optional)', 'image/*,.jpg,.jpeg,.png,.gif,.webp,.svg', true)}
            <MultiImageUploader 
              onChange={(files) => {
                setUploadedFiles(prev => ({
                  ...prev,
                  imageSequence: files
                }));
                // Clear any errors
                if (errors.imageSequence) {
                  setErrors(prev => {
                    const newErrors = { ...prev };
                    delete newErrors.imageSequence;
                    return newErrors;
                  });
                }
              }}
              isSubmitting={isSubmitting}
            />
            {errors.imageSequence && (
              <div className="mt-1 text-sm text-red-500">
                {errors.imageSequence}
              </div>
            )}
            {renderFileInput('transcript', 'Transcript/Subtitles (optional)', 'application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.apple.pages,application/vnd.google-apps.document,.txt,.pdf,.srt,.docx,.pages,.gdoc', true)}
          </>
        );
      case 'reel':
        return (
          <>
            {renderFileInput('preview', 'Thumbnail Image (auto-generated if not provided)', 'image/*,.jpg,.jpeg,.png,.gif,.webp,.svg', true)}
            {renderFileInput('movie', 'Video File', 'video/*,.mp4,.mov,.avi,.webm')}
            {renderFileInput('transcript', 'Transcript', 'application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.apple.pages,application/vnd.google-apps.document,.txt,.pdf,.srt,.docx,.pages,.gdoc', true)}
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
              <div className="text-gray-700 py-1">
                {type === 'image' ? 'Image' : type === 'social' ? 'Social' : 'Reel'}
              </div>
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
            className={`w-full px-3 py-2 border rounded text-sm ${errors.description ? 'border-red-500' : 'border-gray-300'} ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
            rows={3}
            disabled={isSubmitting}
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
            type="text"
            id="date"
            value={date}
            onChange={(e) => {
              // Store raw input
              setDate(e.target.value);
              // Mark date as modified for Enter key handling
              setIsDateModified(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault(); // Prevent form submission
                
                if (isDateModified) {
                  // Parse and format the date
                  const formattedDate = parseAndFormatDate(date);
                  setDate(formattedDate);
                  setIsDateModified(false);
                } else {
                  // If date hasn't been modified, submit the form
                  formRef.current?.dispatchEvent(
                    new Event('submit', { cancelable: true, bubbles: true })
                  );
                }
              }
            }}
            onBlur={() => {
              // On blur, parse the date and reformat if valid
              if (isDateModified) {
                const formattedDate = parseAndFormatDate(date);
                setDate(formattedDate);
                setIsDateModified(false);
              }
            }}
            className={`w-full px-3 py-2 border border-gray-300 rounded text-sm ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
            disabled={isSubmitting}
            placeholder="MM/DD/YYYY"
          />
          <p className="text-xs text-gray-500 mt-1">
            Enter Date MM/DD/YYYY
          </p>
        </div>
        
        <div className="mb-4">
          <h3 className="text-base font-medium mb-2">Tags</h3>
          <div className="relative">
            <div className="flex mb-2">
              <div className="relative w-full">
                <div className="relative flex items-center">
                  <input
                    ref={tagInputRef}
                    type="text"
                    value={newTag}
                    onChange={handleTagInput}
                    placeholder="Type to search or add a new tag"
                    className={`w-full mr-2 px-3 py-2 pr-10 border border-gray-300 rounded text-sm ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                    disabled={isSubmitting}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();

                        // If a tag is selected in the dropdown, use that one
                        if (isTagsDropdownOpen && selectedTagIndex >= 0 && selectedTagIndex < filteredTags.length) {
                          handleTagAdd(filteredTags[selectedTagIndex]);
                        }
                        // If dropdown is open and has suggestions but none selected, use the first one
                        else if (isTagsDropdownOpen && filteredTags.length > 0) {
                          handleTagAdd(filteredTags[0]);
                        } else {
                          // Otherwise use current input
                          handleTagAdd();
                        }
                      } else if (e.key === 'Escape') {
                        setIsTagsDropdownOpen(false);
                      } else if (e.key === 'ArrowDown' && filteredTags.length > 0 && isTagsDropdownOpen) {
                        e.preventDefault();
                        // Move to the next item or first item if none selected
                        setSelectedTagIndex(prev =>
                          prev < filteredTags.length - 1 ? prev + 1 : 0
                        );
                      } else if (e.key === 'ArrowUp' && filteredTags.length > 0 && isTagsDropdownOpen) {
                        e.preventDefault();
                        // Move to the previous item or last item if at beginning
                        setSelectedTagIndex(prev =>
                          prev > 0 ? prev - 1 : filteredTags.length - 1
                        );
                      }
                    }}
                    onFocus={() => {
                      // Do not show dropdown when focusing
                    }}
                    autoComplete="off" // Prevent browser autocomplete from interfering
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!isSubmitting) {
                        setIsTagsDropdownOpen(!isTagsDropdownOpen);
                        if (tagInputRef.current) {
                          tagInputRef.current.focus();
                        }
                      }
                    }}
                    className={`absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 p-1 rounded ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:text-gray-600 hover:bg-gray-100'}`}
                    aria-label={isTagsDropdownOpen ? "Close tag options" : "Show tag options"}
                    disabled={isSubmitting}
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      width="16" 
                      height="16" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                      className={`transition-transform duration-200 ${isTagsDropdownOpen ? 'rotate-180' : ''}`}
                    >
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </button>
                  {isTagsDropdownOpen && (
                    <div
                      id="tags-dropdown"
                      className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto"
                    >
                      {filteredTags.length > 0 ? (
                        filteredTags.map((tag, index) => {
                          // Only highlight the prefix (since we're only doing prefix matching)
                          const lowerInput = newTag.toLowerCase().trim();
                          const isSelected = index === selectedTagIndex;

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
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 focus:bg-blue-50 focus:outline-none ${isSelected ? 'bg-blue-100 font-medium' : ''}`}
                              tabIndex={0}
                              onMouseEnter={() => setSelectedTagIndex(index)}
                            >
                              {tagDisplay}
                            </button>
                          );
                        })
                      ) : (
                        newTag.length > 0 ? (
                          <div className="px-3 py-2 text-sm flex">
                            <span className="text-blue-600 font-medium">{newTag}</span>
                            <span className="text-gray-500 ml-1">(Press Enter to add)</span>
                          </div>
                        ) : (
                          <div className="px-3 py-2 text-sm text-gray-500">
                            No matching tags found
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  // If there's a selected tag in the dropdown, use that
                  if (isTagsDropdownOpen && selectedTagIndex >= 0 && selectedTagIndex < filteredTags.length) {
                    handleTagAdd(filteredTags[selectedTagIndex]);
                  } 
                  // If dropdown is open with suggestions but none selected, use first one
                  else if (isTagsDropdownOpen && filteredTags.length > 0) {
                    handleTagAdd(filteredTags[0]);
                  } 
                  // Otherwise use whatever is in the input
                  else {
                    handleTagAdd();
                  }
                }}
                className={`px-3 py-2 bg-blue-600 text-white rounded text-sm whitespace-nowrap ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'}`}
                disabled={isSubmitting}
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
                  onClick={() => !isSubmitting && handleTagDelete(tag)}
                  className={`ml-1.5 text-blue-600 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:text-blue-800'}`}
                  disabled={isSubmitting}
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
            disabled={isSubmitting}
            className={`px-4 py-2 border border-gray-300 text-gray-700 rounded ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className={`px-4 py-2 bg-blue-600 text-white rounded ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'}`}
          >
            {isSubmitting ? 'Saving...' : (initialData ? 'Update' : 'Create')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CardFormNew;