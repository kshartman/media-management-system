// ACME Client — white-label configuration template
// Copy this file and rename to brand.config.[client-name].ts for new clients
//
// See also: acme-brand/config/brand.config.acme.ts (fully-commented reference)
//           WHITE_LABEL_GUIDE.md (theming & deployment docs)

import type { BrandConfig } from './types';

const brandConfig: BrandConfig = {
  // Company Information
  companyName: 'ACME Corporation',
  appTitle: 'ACME Media Library',
  appDescription: 'ACME Corporation digital asset management system',

  // Visual Assets (place files in public/ directory)
  // Set logoPath to null to show company name as text instead of a logo image
  logoPath: '/acme-logo.png', // or null for text-only header
  faviconPath: '/acme-favicon.ico',
  // ogImage: '/acme-og.png', // Social share image (1200x630 recommended)

  // Theme Colors
  theme: {
    headerBackground: '#f3f4f6', // Gray — neutral header
    primaryColor: '#10b981',      // Green — primary brand color
    adminColor: '#ef4444',        // Red — admin role color
    editorColor: '#10b981',       // Green — editor role color
    // headerColors is auto-computed from headerBackground (WCAG luminance).
    // Override individual keys only if you need pixel-exact control:
    // headerColors: {
    //   text: '#111827',              // Primary text (title, company name)
    //   textMuted: '#374151',         // Icons, secondary elements
    //   border: '#e5e7eb',            // Header bottom border
    //   navActiveText: '#111827',
    //   navActiveBg: '#e5e7eb',
    //   navActiveBorder: '#6b7280',
    //   navInactiveText: '#4b5563',
    //   navHoverText: '#111827',
    //   navHoverBg: '#f9fafb',
    // },
  },

  // External Links — set individual keys to null/undefined to hide,
  // or set the whole object to null to remove the section entirely.
  externalLinks: {
    portal: {
      label: 'Client Portal',
      url: 'https://portal.acmecorp.example.com'
    },
    training: {
      label: 'Training Resources',
      url: 'https://training.acmecorp.example.com'
    }
  },
  // externalLinks: null, // uncomment to remove external links completely

  // Domain Configuration
  domain: 'media.acmecorp.example.com',

  // Trash Configuration
  trash: {
    retentionDays: 30 // Keep deleted items for 30 days before permanent deletion
  },
};

export default brandConfig;
