'use client'

import { CardProps } from '../types';

// Define interface for filters parameter
export interface CardFilters {
  type?: string[];
  tags?: string[];
  search?: string;
}

// Use the API proxy through Next.js rewrites
const API_URL = '/api';
const PAGE_SIZE = 12; // Standard page size - we'll use pagination for more

// Helper function for API requests
const request = async (endpoint: string, options: RequestInit = {}) => {
  // Get auth token if available
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...config,
      mode: 'cors', // Explicitly set CORS mode
      credentials: 'same-origin'
    });

    if (!response.ok) {
      console.error(`API Error: ${response.status}`, await response.text());
      throw new Error(`API Error: ${response.status}`);
    }

    // For DELETE requests that return 204 No Content, don't try to parse JSON
    if (options.method === 'DELETE' && response.status === 204) {
      return;
    }

    // For all other responses, try to parse JSON
    try {
      const data = await response.json();
      return data;
    } catch (jsonError) {
      // If JSON parsing fails, it might be an empty response
      if (response.status === 200 || response.status === 201 || response.status === 202) {
        // Successful response but no JSON content
        return {};
      }
      
      // If it's an actual error, throw it
      console.error(`JSON parsing error for ${endpoint}:`, jsonError);
      throw new Error('Invalid response format from server');
    }
  } catch (error) {
    console.error(`API Error for ${endpoint}:`, error);
    // Add more detailed error information for debugging
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      console.error('This could be due to CORS issues, network connectivity, or server unavailability.');
      console.error('Verify the server is running and CORS is properly configured.');
    }
    throw error;
  }
};

// API functions
export const fetchCards = async (
  page = 1,
  filters: CardFilters = { type: [], tags: [], search: '' },
  limit = PAGE_SIZE
): Promise<{ cards: CardProps[]; availableTags: string[]; totalCount: number }> => {
  
  const queryParams = new URLSearchParams();
  queryParams.append('page', page.toString());
  queryParams.append('limit', limit.toString());

  if (filters.search) {
    queryParams.append('search', filters.search);
  }

  if (filters.type && filters.type.length > 0) {
    filters.type.forEach(type => queryParams.append('type', type));
  }

  if (filters.tags && filters.tags.length > 0) {
    filters.tags.forEach(tag => queryParams.append('tag', tag));
  }
  
  const queryString = queryParams.toString();

  const response = await request(`/cards?${queryString}`);
  

  // Map MongoDB _id to id for client-side compatibility
  interface RawCard {
    _id?: string;
    id?: string;
    [key: string]: unknown; // For other properties
  }
  
  const mappedCards = response.cards.map((card: RawCard) => {
    if ('_id' in card && !('id' in card)) {
      return {
        ...card,
        id: card._id,
      } as unknown as CardProps;
    }
    return card as unknown as CardProps;
  });

  return {
    ...response,
    cards: mappedCards,
  };
};

export const fetchCardById = async (id: string): Promise<CardProps> => {
  const card = await request(`/cards/${id}`);

  // Map MongoDB _id to id for client-side compatibility
  if ('_id' in card && !('id' in card)) {
    return {
      ...card,
      id: card._id,
    };
  }

  return card;
};

export const createCard = async (cardData: FormData): Promise<CardProps> => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  if (!token) {
    throw new Error('Authentication required');
  }

  try {
    const response = await fetch(`${API_URL}/cards`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: cardData, // Using FormData for file uploads
    });

    if (!response.ok) {
      console.error(`API Error: ${response.status}`, await response.text());
      throw new Error(`API Error: ${response.status}`);
    }

    const card = await response.json();

    // Map MongoDB _id to id for client-side compatibility
    if ('_id' in card && !('id' in card)) {
      return {
        ...card,
        id: card._id,
      };
    }

    return card;
  } catch (error) {
    console.error('Error creating card:', error);
    throw error;
  }
};

export const updateCard = async (id: string, cardData: FormData): Promise<CardProps> => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  if (!token) {
    throw new Error('Authentication required');
  }

  try {
    const response = await fetch(`${API_URL}/cards/${id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: cardData, // Using FormData for file uploads
    });

    if (!response.ok) {
      console.error(`API Error: ${response.status}`, await response.text());
      throw new Error(`API Error: ${response.status}`);
    }

    const card = await response.json();

    // Map MongoDB _id to id for client-side compatibility
    if ('_id' in card && !('id' in card)) {
      return {
        ...card,
        id: card._id,
      };
    }

    return card;
  } catch (error) {
    console.error('Error updating card:', error);
    throw error;
  }
};

export const deleteCard = async (id: string): Promise<void> => {
  try {
    return await request(`/cards/${id}`, { method: 'DELETE' });
  } catch (error) {
    console.error(`Error deleting card ${id}:`, error);
    
    // Rethrow the error so it can be handled by the caller
    throw new Error('Failed to delete card. Please try again.');
  }
};

export const login = async (credentials: { username: string; password: string }): Promise<{ token: string; user: { id: string; username: string; role: string } }> => {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
};

export const logout = (): void => {
  // Client-side logout (just removing the token)
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth_token');
  }
};

export const getAllTags = async (): Promise<string[]> => {
  const response = await request('/tags');
  return response;
};

// Update only the social copy without updating the entire card
export const updateSocialCopy = async (id: string, data: { instagramCopy?: string | null, facebookCopy?: string | null }): Promise<CardProps> => {
  try {
    const response = await request(`/cards/${id}/social-copy`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    
    // Map MongoDB _id to id for client-side compatibility
    if ('_id' in response && !('id' in response)) {
      return {
        ...response,
        id: response._id,
      };
    }
    
    return response;
  } catch (error) {
    console.error('Error updating social copy:', error);
    throw error;
  }
};

// User Management API Functions
export interface User {
  id?: string;
  _id?: string;
  username: string;
  email: string;
  role: 'admin' | 'editor';
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
}

export interface UserCreateInput {
  username: string;
  email: string;
  password?: string; // Optional - users will set password via welcome email
  role: 'admin' | 'editor';
}

export interface UserUpdateInput {
  username?: string;
  email?: string;
  password?: string;
  role?: 'admin' | 'editor';
}

// Get all users (admin only)
export const getUsers = async (): Promise<User[]> => {
  const response = await request('/users');
  return response;
};

// Get a single user by ID (admin only)
export const getUserById = async (id: string): Promise<User> => {
  const response = await request(`/users/${id}`);
  return response;
};

// Create a new user (admin only)
export const createUser = async (userData: UserCreateInput): Promise<User> => {
  const response = await request('/users', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
  return response;
};

// Update a user (admin only)
export const updateUser = async (id: string, userData: UserUpdateInput): Promise<User> => {
  const response = await request(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(userData),
  });
  return response;
};

// Delete a user (admin only)
export const deleteUser = async (id: string): Promise<void> => {
  return request(`/users/${id}`, { method: 'DELETE' });
};

// Send password reset link to a user (admin only)
export const sendPasswordResetLink = async (id: string): Promise<{ message: string; email: string; expiresAt: string }> => {
  return request(`/users/${id}/send-reset-link`, { method: 'POST' });
};
