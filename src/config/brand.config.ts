// Default brand configuration for the Media Management System
// This file contains all branding elements that can be customized per client

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