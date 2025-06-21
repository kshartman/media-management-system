/** @type {import('next').NextConfig} */

// Get allowed origins from environment or use defaults
const getAllowedOrigins = () => {
  if (process.env.ALLOWED_ORIGINS) {
    return process.env.ALLOWED_ORIGINS.split(',');
  }
  
  // Default development origins
  return [
    'http://localhost:3000',
    'http://localhost:3002', 
    'http://localhost:5000',
    'http://127.0.0.1:3000',
    'http://lakedev:3000',
    'http://lakedev',
    'http://mppro4:3000',
    'http://mppro4',
  ];
};

const nextConfig = {
  output: 'standalone',
  
  // Configure allowed origins for Next.js development server
  ...(process.env.NODE_ENV === 'development' && {
    experimental: {
      // This is the key config for Next.js CORS in development
      allowedOrigins: getAllowedOrigins(),
    },
  }),
  
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