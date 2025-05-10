'use client';

import React, { useState } from 'react';
import { CardProps } from '../../types';

interface CardFormProps {
  initialData?: CardProps;
  onSubmit: (formData: FormData) => Promise<void>;
  onCancel: () => void;
}

const CardForm: React.FC<CardFormProps> = ({ initialData, onSubmit, onCancel }) => {
  const [type, setType] = useState<'image' | 'social' | 'reel'>(initialData?.type || 'image');
  const [description, setDescription] = useState(initialData?.description || '');
  const [tags, setTags] = useState<string[]>(initialData?.tags || []);
  const [newTag, setNewTag] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, File | null>>({
    preview: null,
    download: null,
    documentCopy: null,
    movie: null,
    transcript: null,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set up the required fields based on card type
  const getRequiredFields = () => {
    const common = ['preview', 'description'];
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
      setUploadedFiles(prev => ({
        ...prev,
        [field]: e.target.files![0],
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

  const handleTagAdd = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
      
      // Clear tag error if it exists
      if (errors.tags) {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.tags;
          return newErrors;
        });
      }
    }
  };
  
  const handleTagDelete = (tagToDelete: string) => {
    setTags(tags.filter(tag => tag !== tagToDelete));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const formData = new FormData();
      formData.append('type', type);
      formData.append('description', description);
      formData.append('tags', tags.join(','));
      
      // Append files if they exist
      Object.entries(uploadedFiles).forEach(([field, file]) => {
        if (file) {
          formData.append(field, file);
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
    }
  };

  const renderFileInput = (field: string, label: string, accept?: string) => (
    <div className="mb-4">
      <div className="font-medium mb-1 text-sm">{label}</div>
      <input
        id={field}
        type="file"
        onChange={handleFileChange(field)}
        accept={accept}
        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
      />
      {initialData && initialData[field as keyof CardProps] && (
        <div className="mt-1 text-sm text-gray-600">
          Current file: {typeof initialData[field as keyof CardProps] === 'string' ? 
            (initialData[field as keyof CardProps] as string).split('/').pop() : 
            'File'
          }
        </div>
      )}
      {errors[field] && (
        <div className="mt-1 text-sm text-red-500">
          {errors[field]}
        </div>
      )}
    </div>
  );

  const renderCardTypeFields = () => {
    switch (type) {
      case 'image':
        return (
          <>
            {renderFileInput('preview', 'Preview Image', 'image/*')}
            {renderFileInput('download', 'Downloadable Image', 'image/*')}
          </>
        );
      case 'social':
        return (
          <>
            {renderFileInput('preview', 'Preview Image', 'image/*')}
            {renderFileInput('documentCopy', 'Document Copy', '.txt,.pdf,.doc,.docx')}
          </>
        );
      case 'reel':
        return (
          <>
            {renderFileInput('preview', 'Thumbnail Image', 'image/*')}
            {renderFileInput('movie', 'Video File', 'video/*')}
            {renderFileInput('transcript', 'Transcript', '.txt,.pdf,.srt')}
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
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <h3 className="text-base font-medium mb-2">Card Type</h3>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="type"
                checked={type === 'image'}
                onChange={() => setType('image')}
                className="mr-2"
              />
              Image
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="type"
                checked={type === 'social'}
                onChange={() => setType('social')}
                className="mr-2"
              />
              Social
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="type"
                checked={type === 'reel'}
                onChange={() => setType('reel')}
                className="mr-2"
              />
              Reel
            </label>
          </div>
        </div>
        
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
          <h3 className="text-base font-medium mb-2">Tags</h3>
          <div className="flex mb-2">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Add a tag"
              className="w-full mr-2 px-3 py-2 border border-gray-300 rounded text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleTagAdd();
                }
              }}
            />
            <button 
              type="button"
              onClick={handleTagAdd}
              className="px-3 py-2 bg-blue-600 text-white rounded text-sm"
            >
              Add
            </button>
          </div>
          
          <div className="flex flex-wrap gap-2 mt-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
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

export default CardForm;