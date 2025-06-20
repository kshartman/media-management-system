'use client'

import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { login as apiLogin, logout as apiLogout } from './auth-api';

interface User {
  id: string;
  username: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isEditor: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isAdmin: false,
  isEditor: false,
  isLoading: true,
  login: async () => {},
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if we're running in a browser environment
    if (typeof window !== 'undefined') {
      // Check if user is logged in
      const token = localStorage.getItem('auth_token');
      if (token) {
        try {
          // Decode JWT payload
          const payload = JSON.parse(atob(token.split('.')[1]));
          
          // Check if token has expired
          if (payload.exp) {
            const expirationTime = payload.exp * 1000; // Convert to milliseconds
            const currentTime = Date.now();
            
            if (currentTime >= expirationTime) {
              // Token has expired
              localStorage.removeItem('auth_token');
              // Don't set user if token is expired
              setIsLoading(false);
              return;
            }
          }
          
          setUser({
            id: payload.id,
            username: payload.username,
            role: payload.role,
          });
        } catch (error) {
          console.error('Invalid token:', error);
          localStorage.removeItem('auth_token');
        }
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    try {
      const { token, user } = await apiLogin({ username, password });
      if (typeof window !== 'undefined') {
        localStorage.setItem('auth_token', token);
      }
      setUser(user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    apiLogout();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated: !!user,
      isAdmin: user?.role === 'admin' || false,
      isEditor: user?.role === 'admin' || user?.role === 'editor' || false,
      isLoading, 
      login, 
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
};