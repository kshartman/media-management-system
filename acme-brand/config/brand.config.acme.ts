// ACME Corporation Brand Configuration (EXAMPLE)
//
// This is the canonical reference for how to configure a client brand.
// Every BrandConfig field is shown here with comments explaining its purpose.
//
// Usage:
//   1. Copy this file to your brand's config/ directory
//   2. Rename to brand.config.<brand>.ts
//   3. Set NEXT_PUBLIC_BRAND_CONFIG=<brand> in your environment
//   4. Run deploy.sh to copy it into src/config/brand.config.ts
//
// See also: src/config/types.ts (BrandConfig interface)
//           WHITE_LABEL_GUIDE.md (theming docs)

import type { BrandConfig } from '../../src/config/types';

const brandConfig: BrandConfig = {
  // ── Company Information ──────────────────────────────────────────────
  companyName: 'ACME Corporation',
  appTitle: 'ACME Media Library',
  appDescription: 'ACME Corporation digital asset management system',

  // ── Visual Assets ────────────────────────────────────────────────────
  // Files are served from the Next.js public/ directory.
  // deploy.sh copies brand assets into public/ at build time.
  //
  // Set logoPath to null to display companyName as text instead of an image.
  logoPath: '/logo-placeholder.png',  // or null for text-only header
  faviconPath: '/favicon.ico',

  // Social share / Open Graph image (1200x630px recommended).
  // Shown when links are shared on social media, Slack, etc.
  // Omit or set to null if you don't need one.
  // ogImage: '/acme-og.png',

  // ── Theme Colors ─────────────────────────────────────────────────────
  theme: {
    headerBackground: '#e6f3ff', // Light blue header
    primaryColor: '#0066cc',      // ACME blue — buttons, links, active states
    adminColor: '#cc0066',        // Admin role badge / accent color
    editorColor: '#0066cc',       // Editor role badge / accent color

    // Header text/icon colors are auto-computed from headerBackground using
    // WCAG relative-luminance detection (light bg → dark text, dark bg → light text).
    //
    // Override individual keys only if the auto-computed values don't match
    // your brand guidelines.  All keys are optional — omit the whole object
    // to use auto-detection, or specify only the keys you need to override.
    //
    // headerColors: {
    //   text: '#111827',              // Primary text (title, company name)
    //   textMuted: '#374151',         // Icons, secondary elements
    //   border: '#e5e7eb',            // Header bottom border
    //   navActiveText: '#111827',     // Selected tab text
    //   navActiveBg: '#e5e7eb',       // Selected tab background
    //   navActiveBorder: '#6b7280',   // Selected tab underline
    //   navInactiveText: '#4b5563',   // Unselected tab text
    //   navHoverText: '#111827',      // Tab hover text
    //   navHoverBg: '#f9fafb',        // Tab hover background
    // },
  },

  // ── External Links ───────────────────────────────────────────────────
  // Shown in the hamburger menu.  Set individual keys to null/undefined
  // to hide one link, or set the whole object to null to remove the section.
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
  // externalLinks: null, // uncomment to remove external links completely

  // ── Domain ───────────────────────────────────────────────────────────
  // Used in generated links, CORS defaults, and documentation.
  domain: 'media.acmecorp.example.com',

  // ── Trash / Soft-Delete ──────────────────────────────────────────────
  trash: {
    retentionDays: 30 // Days before soft-deleted cards are permanently purged
  },
};

export default brandConfig;
