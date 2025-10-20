import type { NextConfig } from "next";
const  S3_BUCKET_HOSTNAME = process.env.S3_BUCKET_HOSTNAME;

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
  
  // Bundle optimization settings
  experimental: {
    optimizePackageImports: ['react-icons', 'lucide-react'],
  },
  
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Bundle optimization for production builds
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          // Admin components - only loaded when needed
          admin: {
            test: /[\\/]components[\\/]admin[\\/]/,
            name: 'admin',
            chunks: 'all',
            priority: 20,
          },
          // Auth components
          auth: {
            test: /[\\/]components[\\/]auth[\\/]/,
            name: 'auth', 
            chunks: 'all',
            priority: 15,
          },
          // Card components - heavily used
          cards: {
            test: /[\\/]components[\\/]cards[\\/]/,
            name: 'cards',
            chunks: 'all',
            priority: 10,
          },
          // Common vendor libraries
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 5,
          },
        },
      };
    }
    
    return config;
  },
  
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
        hostname: `${S3_BUCKET_HOSTNAME}`,
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
