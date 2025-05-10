'use client'

// Use the API proxy through Next.js rewrites
const API_URL = '/api';

// Auth API functions
export const login = async (credentials: { username: string; password: string }): Promise<{ token: string; user: { id: string; username: string; role: string } }> => {
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error: ${response.status}`, errorText);
      throw new Error('Invalid username or password');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

export const logout = (): void => {
  // Client-side logout (just removing the token)
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth_token');
  }
};