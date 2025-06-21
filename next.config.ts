import type { NextConfig } from "next";

// Get allowed origins from environment or use defaults
const getAllowedOrigins = () => {
  // Default localhost variants for development
  const defaultOrigins = [
    'http://localhost:3000',
    'http://localhost:3002', 
    'http://localhost:5000',
    'http://127.0.0.1:3000',
  ];
  
  if (process.env.ALLOWED_ORIGINS) {
    const envOrigins = process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
    // Merge environment origins with default localhost variants
    return [...defaultOrigins, ...envOrigins];
  }
  
  return defaultOrigins;
};

const nextConfig: NextConfig = {
  output: 'standalone',
  
  // Allow development origins for Next.js dev server
  allowedDevOrigins: getAllowedOrigins(),
  
  // Additional CORS headers for development
  async headers() {
    // Only apply in development
    if (process.env.NODE_ENV !== 'development') {
      return [];
    }
    
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*', // Allow all origins in development
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },
    ];
  },
  
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
      },
      {
        protocol: 'https',
        hostname: 'zivepublic.s3.us-east-1.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: '*.s3.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: '*.s3.*.amazonaws.com',
      },
    ],
  },
  
  async rewrites() {
    // Use environment variable for backend URL, default to localhost for development
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
