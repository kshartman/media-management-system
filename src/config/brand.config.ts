// Default brand configuration for the Media Management System
// This file contains generic branding elements that can be customized per client

import type { BrandConfig } from './types';

const brandConfig: BrandConfig = {
  // Company Information
  companyName: 'Media Management System',
  appTitle: 'Media Management System',
  appDescription: 'A system for managing and browsing digital media assets',
  
  // Visual Assets
  logoPath: null, // No logo by default - will show company name instead
  faviconPath: '/favicon.ico',
  
  // Theme Colors
  theme: {
    headerBackground: '#f3f4f6', // Light gray - neutral header
    primaryColor: '#6b7280',     // Gray - neutral primary color
    adminColor: '#dc2626',       // Red - admin role color
    editorColor: '#2563eb',      // Blue - editor role color
  },
  
  // External Links (set to null to hide menu items)
  externalLinks: null, // No external links by default
  
  // Domain Configuration (used in .env files)
  domain: 'media.example.com',
  
  // Trash Configuration
  trash: {
    retentionDays: 30 // Keep deleted items for 30 days before permanent deletion
  },
};

export default brandConfig;