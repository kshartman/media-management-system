// Default generic brand configuration
// This is the fallback configuration when no specific brand is set

import type { BrandConfig } from './types';

const brandConfig: BrandConfig = {
  // Company Information
  companyName: 'Media Management System',
  appTitle: 'Media Library',
  appDescription: 'A system for managing and browsing digital media assets',

  // Visual Assets
  logoPath: '/logo-placeholder.png',
  faviconPath: '/favicon.ico',

  // Theme Colors
  theme: {
    headerBackground: '#f3f4f6', // Light gray
    primaryColor: '#3b82f6',      // Blue
    adminColor: '#9333ea',        // Purple
    editorColor: '#3b82f6',       // Blue
  },

  // External Links (omit to hide menu items)
  externalLinks: {
    // No external links in generic version
  },

  // Domain Configuration (used in .env files)
  domain: 'localhost:3000',

  // Trash Configuration
  trash: {
    retentionDays: 30 // Keep deleted items for 30 days before permanent deletion
  },
};

export default brandConfig;
