import { NextConfig } from 'next';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '500mb',
    },
    responseLimit: '500mb',
  },
} as NextConfig;