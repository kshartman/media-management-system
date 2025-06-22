// Example white-label configuration for a fictional client
// Copy this file and rename to brand.config.[client-name].ts for new clients

import type { BrandConfig } from './types';

const brandConfig: BrandConfig = {
  // Company Information
  companyName: 'Example Corp',
  appTitle: 'Example Media Library',
  appDescription: 'Example Corp digital asset management system',
  
  // Visual Assets (place files in public/ directory)
  // Set logoPath to null to show company name instead of logo
  logoPath: '/example-logo.png', // or null for text-only
  faviconPath: '/example-favicon.ico',
  
  // Theme Colors
  theme: {
    headerBackground: '#f3f4f6', // Gray - neutral header
    primaryColor: '#10b981',      // Green - primary brand color
    adminColor: '#ef4444',        // Red - admin role color
    editorColor: '#10b981',       // Green - editor role color
  },
  
  // External Links - set to null to remove external links from menu
  externalLinks: {
    portal: {
      label: 'Client Portal',
      url: 'https://portal.example.com'
    },
    training: {
      label: 'Training Resources',
      url: 'https://training.example.com'
    }
  },
  // Or set to null to remove external links completely:
  // externalLinks: null,
  
  // Domain Configuration
  domain: 'media.example.com',
  
  // Trash Configuration
  trash: {
    retentionDays: 30 // Keep deleted items for 30 days before permanent deletion
  },
};

export default brandConfig;