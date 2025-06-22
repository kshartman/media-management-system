// Zive-specific brand configuration
// This file contains the actual Zive branding elements

import type { BrandConfig } from './types';

const brandConfig: BrandConfig = {
  // Company Information
  companyName: 'Affiliate Resources',
  appTitle: 'Affiliate Resources',
  appDescription: 'A system for managing and browsing digital media assets',
  
  // Visual Assets
  logoPath: '/zive-logo.png',
  faviconPath: '/favicon.ico',
  
  // Theme Colors
  theme: {
    headerBackground: '#d9f2fc', // Light blue - used in header
    primaryColor: '#3b82f6',      // Blue - primary brand color
    adminColor: '#9333ea',        // Purple - admin role color
    editorColor: '#3b82f6',       // Blue - editor role color
  },
  
  // External Links (set to null to hide menu items)
  externalLinks: {
    portal: {
      label: 'Affiliate Portal',
      url: 'https://affiliates.shopzive.com'
    },
    training: {
      label: 'Affiliate Training', 
      url: 'https://shopzive.com/pages/zivepro-affiliate-resources'
    }
  },
  
  // Domain Configuration (used in .env files)
  domain: 'resources.shopzive.com',
  
  // Trash Configuration
  trash: {
    retentionDays: 30 // Keep deleted items for 30 days before permanent deletion
  },
};

export default brandConfig;