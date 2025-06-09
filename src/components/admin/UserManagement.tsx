'use client';

import React, { useState, useEffect } from 'react';
import { User, UserCreateInput, UserUpdateInput, getUsers, createUser, updateUser, deleteUser } from '../../lib/api';
import UserForm from './UserForm';

interface UserManagementProps {
  isOpen: boolean;
  onClose: () => void;
}

const UserManagement: React.FC<UserManagementProps> = ({ isOpen, onClose }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch users on component mount
  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getUsers();
      setUsers(data);
    } catch {
      setError('Failed to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (userData: UserCreateInput | UserUpdateInput) => {
    try {
      setIsSubmitting(true);
      // Type assertion to ensure we have all required fields for UserCreateInput
      await createUser(userData as UserCreateInput);
      setShowCreateForm(false);
      setSuccessMessage('User created successfully');
      fetchUsers(); // Refresh the user list
    } catch {
      setError('Failed to create user. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateUser = async (userData: UserUpdateInput) => {
    if (!userToEdit?.id && !userToEdit?._id) return;
    
    try {
      setIsSubmitting(true);
      const userId = userToEdit.id || userToEdit._id as string;
      await updateUser(userId, userData);
      setUserToEdit(null);
      setSuccessMessage('User updated successfully');
      fetchUsers(); // Refresh the user list
    } catch {
      setError('Failed to update user. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }
    
    try {
      await deleteUser(userId);
      setSuccessMessage('User deleted successfully');
      fetchUsers(); // Refresh the user list
    } catch {
      setError('Failed to delete user. Please try again.');
    }
  };

  // Clear success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-auto" style={{ backdropFilter: 'blur(2px)' }}>
      <div 
        className="fixed inset-0 bg-black bg-opacity-30"
        onClick={onClose}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'Escape') {
            onClose();
          }
        }}
        aria-label="Close modal"
      ></div>
      
      <div className="relative mx-auto mt-16 mb-16 max-w-4xl">
        <div className="bg-white rounded-lg shadow-2xl border border-gray-200">
          <div className="sticky top-0 z-50 bg-white px-6 py-4 border-b flex justify-between items-center rounded-t-lg">
            <h3 className="text-xl font-semibold text-gray-900">
              User Management
            </h3>
            <button
              className="text-gray-500 hover:text-gray-700"
              onClick={onClose}
              title="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="px-6 py-4">
            {successMessage && (
              <div className="mb-4 p-3 bg-green-50 border border-green-400 text-green-700 rounded">
                {successMessage}
              </div>
            )}
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-400 text-red-700 rounded">
                {error}
              </div>
            )}

            {/* Create/Edit User Form */}
            {(showCreateForm || userToEdit) && (
              <div className="mb-6 p-4 border border-gray-200 rounded-lg">
                <h4 className="text-lg font-medium mb-4">
                  {userToEdit ? 'Edit User' : 'Create New User'}
                </h4>
                <UserForm
                  initialData={userToEdit || undefined}
                  onSubmit={userToEdit ? handleUpdateUser : handleCreateUser}
                  onCancel={() => {
                    setShowCreateForm(false);
                    setUserToEdit(null);
                  }}
                  isSubmitting={isSubmitting}
                />
              </div>
            )}

            {/* User List */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-medium">Users</h4>
                {!showCreateForm && !userToEdit && (
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                  >
                    Add New User
                  </button>
                )}
              </div>
              
              {loading ? (
                <div className="flex justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Username
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Role
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {users.map((user) => (
                        <tr key={user.id || user._id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {user.username}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {user.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'
                            }`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <button 
                              onClick={() => setUserToEdit(user)}
                              className="text-blue-600 hover:text-blue-900 mr-4"
                            >
                              Edit
                            </button>
                            <button 
                              onClick={() => handleDeleteUser(user.id || user._id as string)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                      {users.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                            No users found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;