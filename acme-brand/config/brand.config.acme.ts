// ACME Corporation Brand Configuration (EXAMPLE)
// This is a reference implementation showing how to configure a client brand
// Copy this file and customize it for your own client

import type { BrandConfig } from '../../src/config/types';

const brandConfig: BrandConfig = {
  // Company Information
  companyName: 'ACME Corporation',
  appTitle: 'ACME Media Library',
  appDescription: 'ACME Corporation digital asset management system',

  // Visual Assets
  logoPath: '/logo-placeholder.png',  // Link your logo here
  faviconPath: '/favicon.ico',

  // Theme Colors
  theme: {
    headerBackground: '#e6f3ff', // Light blue
    primaryColor: '#0066cc',      // ACME blue
    adminColor: '#cc0066',        // ACME magenta for admin
    editorColor: '#0066cc',       // ACME blue for editor
  },

  // External Links (set to null to hide menu items)
  externalLinks: {
    portal: {
      label: 'ACME Portal',
      url: 'https://portal.acmecorp.example.com'
    },
    training: {
      label: 'Training Center',
      url: 'https://training.acmecorp.example.com'
    }
  },

  // Domain Configuration (used in .env files)
  domain: 'media.acmecorp.example.com',

  // Trash Configuration
  trash: {
    retentionDays: 30 // Keep deleted items for 30 days before permanent deletion
  },
};

export default brandConfig;
