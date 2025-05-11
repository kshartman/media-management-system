'use client';

import React, { useState, useEffect } from 'react';
import { User, UserCreateInput, UserUpdateInput } from '../../lib/api';

interface UserFormProps {
  initialData?: User;
  onSubmit: (userData: UserCreateInput | UserUpdateInput) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

const UserForm: React.FC<UserFormProps> = ({ 
  initialData, 
  onSubmit, 
  onCancel,
  isSubmitting = false
}) => {
  const [username, setUsername] = useState(initialData?.username || '');
  const [email, setEmail] = useState(initialData?.email || '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>(initialData?.role || 'user');
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const isEditMode = !!initialData;

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!username.trim()) {
      newErrors.username = 'Username is required';
    }
    
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      newErrors.email = 'Invalid email format';
    }
    
    if (!isEditMode && !password) {
      newErrors.password = 'Password is required for new users';
    } else if (password && password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      const userData: UserCreateInput | UserUpdateInput = {
        username,
        email,
        role
      };
      
      // Only include password if it's provided (required for new users, optional for edits)
      if (password) {
        userData.password = password;
      }
      
      await onSubmit(userData);
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        form: 'An error occurred while saving. Please try again.'
      }));
    }
  };

  return (
    <div>
      {errors.form && (
        <div className="mb-4 p-4 bg-red-50 border border-red-400 text-red-700 rounded">
          {errors.form}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={`w-full px-3 py-2 border rounded ${errors.username ? 'border-red-500' : 'border-gray-300'}`}
          />
          {errors.username && (
            <div className="mt-1 text-sm text-red-500">
              {errors.username}
            </div>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`w-full px-3 py-2 border rounded ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
          />
          {errors.email && (
            <div className="mt-1 text-sm text-red-500">
              {errors.email}
            </div>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="password">
            {isEditMode ? 'Password (leave blank to keep current)' : 'Password'}
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`w-full px-3 py-2 border rounded ${errors.password ? 'border-red-500' : 'border-gray-300'}`}
          />
          {errors.password && (
            <div className="mt-1 text-sm text-red-500">
              {errors.password}
            </div>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="role">
            Role
          </label>
          <select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value as 'admin' | 'user')}
            className="w-full px-3 py-2 border border-gray-300 rounded"
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        
        <div className="flex justify-end gap-3 pt-4">
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
            {isSubmitting ? 'Saving...' : (isEditMode ? 'Update User' : 'Create User')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default UserForm;