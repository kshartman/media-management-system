'use client'

import { CardProps } from '../types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';
const PAGE_SIZE = 12;

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

  console.log(`API Request to ${API_URL}${endpoint}`, config);

  try {
    const response = await fetch(`${API_URL}${endpoint}`, config);
    
    if (!response.ok) {
      console.error(`API Error: ${response.status}`, await response.text());
      throw new Error(`API Error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`API Response from ${endpoint}:`, data);
    return data;
  } catch (error) {
    console.error(`API Error for ${endpoint}:`, error);
    throw error;
  }
};

// API functions
export const fetchCards = async (
  page = 1,
  filters: { type: string[]; tags: string[]; search: string } = { type: [], tags: [], search: '' }
): Promise<{ cards: CardProps[]; availableTags: string[]; totalCount: number }> => {
  const queryParams = new URLSearchParams();
  queryParams.append('page', page.toString());
  queryParams.append('limit', PAGE_SIZE.toString());
  
  if (filters.search) {
    queryParams.append('search', filters.search);
  }
  
  if (filters.type && filters.type.length > 0) {
    filters.type.forEach(type => queryParams.append('type', type));
  }
  
  if (filters.tags && filters.tags.length > 0) {
    filters.tags.forEach(tag => queryParams.append('tag', tag));
  }

  return request(`/cards?${queryParams.toString()}`);
};

export const fetchCardById = async (id: string): Promise<CardProps> => {
  return request(`/cards/${id}`);
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

    return response.json();
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

    return response.json();
  } catch (error) {
    console.error('Error updating card:', error);
    throw error;
  }
};

export const deleteCard = async (id: string): Promise<void> => {
  return request(`/cards/${id}`, { method: 'DELETE' });
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
  return request('/tags');
};
