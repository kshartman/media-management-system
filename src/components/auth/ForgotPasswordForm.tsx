'use client';

import React, { useState } from 'react';
import { forgotPassword } from '../../lib/auth-api';

interface ForgotPasswordFormProps {
  onBackToLogin: () => void;
}

const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({ onBackToLogin }) => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    
    try {
      const response = await forgotPassword(email);
      setMessage(response.message);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send password reset email');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-md mx-auto mt-8">
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="bg-green-600 mb-4 py-8 flex items-center justify-center">
            <h2 className="text-2xl font-bold text-white">
              Check Your Email
            </h2>
          </div>
          
          <div className="px-6 py-4">
            <div className="bg-green-50 text-green-700 p-4 rounded-md border border-green-200 mb-4">
              {message}
            </div>
            
            <p className="text-gray-600 mb-4">
              Please check your email inbox and follow the instructions to reset your password.
            </p>
            
            <button
              onClick={onBackToLogin}
              className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-8">
      <div className="bg-white shadow-lg rounded-lg overflow-hidden">
        <div className="bg-blue-600 mb-4 py-8 flex items-center justify-center">
          <h2 className="text-2xl font-bold text-white">
            Reset Password
          </h2>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 flex flex-col gap-4">
            {error && (
              <div className="bg-red-50 text-red-700 p-4 rounded-md border border-red-200">
                {error}
              </div>
            )}
            
            <p className="text-gray-600 text-sm">
              Enter your email address and we'll send you a link to reset your password.
            </p>
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
          </div>
          
          <div className="px-6 pb-6 pt-0">
            <button 
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 mb-3"
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
            
            <button
              type="button"
              onClick={onBackToLogin}
              className="w-full py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Back to Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ForgotPasswordForm;