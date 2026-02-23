# Changelog

All notable changes to the Media Management System will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### TODO
- Replace `axios` with native `fetch` in `server/utils/zipCardFiles.js`, `cardHelpers.js`, `zipSequence.js` — only used for simple GET→buffer/stream downloads, axios is unnecessary overhead
- Frontend `minimatch` ReDoS (13 high via eslint chain) — requires breaking eslint downgrade, deferred until eslint ecosystem catches up

## [0.2.4] - 2026-02-23

### Security
- **Backend** `qs` 6.13→6.14.2 / `express` 4.21→4.22.1: Fixed arrayLimit bypass allowing DoS via memory exhaustion (HIGH, GHSA-6rw7-vpxm-498p, GHSA-w7fw-mjwx-w883)
- **Backend** `fast-xml-parser` 4.x→5.3.6: Fixed 3 DoS/bypass issues — RangeError numeric entities (GHSA-37qj-frw5-hhjh), entity expansion DoS (GHSA-jmr7-xgp7-cmfj), entity encoding bypass (GHSA-m7jm-9gc2-mpf2) — cascading through `@aws-sdk/xml-builder`→`@aws-sdk/core`→`@aws-sdk/client-s3`
- **Backend** `axios` 1.7→1.13.5: Fixed DoS via `__proto__` key in mergeConfig (HIGH, GHSA-43fc-jf86-j433)
- **Frontend** `next` 15.5.9→15.5.12: Fixed Image Optimizer remotePatterns DoS (GHSA-9g9p-9gw9-jx7f), RSC deserialization DoS (GHSA-h25m-26qc-wcjf)
- **Frontend** `lodash` 4.17.21→4.17.23: Fixed prototype pollution in `_.unset`/`_.omit` (GHSA-xxjr-mmjv-4gpg)
- **Frontend** `ajv` 6.12→6.14.0: Fixed ReDoS with `$data` option (GHSA-2g4f-4pwh-qvx6)
- **Frontend** `markdown-it` 14.1.0→14.1.1: Fixed ReDoS (GHSA-38c4-r59v-3vqw)
- **Backend** `minimatch` patched via nodemon update; **Frontend** minimatch via eslint chain deferred (dev-only, requires breaking change)
- npm audit: backend 0 vulnerabilities, frontend 13 remaining (all dev-only eslint/minimatch)

## [0.2.3] - 2026-02-23

### Added
- Auto-adaptive header theming based on WCAG luminance detection
- New optional `headerColors` sub-object in `BrandConfig.theme` for per-brand color overrides
- `getHeaderColor()` export for accessing computed header colors
- CSS custom property driven nav tab hover states for inline-style compatibility

### Changed
- Header text, icons, nav tabs, and border colors are now auto-computed from `headerBackground`
- Dark headers (e.g. `#A10000`) automatically get white/light text
- Light headers (e.g. `#f3f4f6`, `#d9f2fc`) compute to equivalent Tailwind gray values — no visual change
- No existing brand config files were modified; all brands auto-compute correct values

### Migration notes
Two minor cosmetic shifts on light-background headers vs pre-0.2.3 hardcoded Tailwind classes:
- Avatar icon: was `text-gray-600` (`#4b5563`), now inherits `textMuted` (`#374151` / gray-700)
- Hamburger hover: lost CSS hover darkening since inline styles override Tailwind hover classes

To restore exact previous behavior, add `headerColors: { textMuted: '#4b5563' }` to the brand's `theme` object.

## [0.2.2] - 2025-12-12

### Security
- **CRITICAL**: Complete fix for React Server Components vulnerabilities
  - CVE-2025-55184 (CVSS 7.5): DoS via infinite loop in Server Functions
  - CVE-2025-67779 (CVSS 7.5): Incomplete fix for CVE-2025-55184
  - CVE-2025-55183 (CVSS 5.3): Source code leak in Server Functions
  - Updated Next.js from 15.5.7 to 15.5.9
  - Updated React from 19.2.1 to 19.2.3
  - Updated React-DOM from 19.2.1 to 19.2.3

## [0.2.1] - 2025-12-12

### Security
- **CRITICAL**: Patched React Server Components RCE vulnerability (CVE-2025-55182, CVE-2025-66478)
  - Updated Next.js from 15.5.6 to 15.5.7
  - Updated React from 19.2.0 to 19.2.1
  - Updated React-DOM from 19.2.0 to 19.2.1
- Fixed additional vulnerabilities: glob (high), js-yaml (moderate), jws (high)
- npm audit: 0 vulnerabilities in frontend and backend

### Changed
- Updated browserslist database (caniuse-lite) to latest version

## [0.2.0+1] - Unreleased Changes Before 0.2.1

### Security
- Fixed 4 HIGH severity multer vulnerabilities:
  - CVE-2025-47944: DoS via unhandled exception from malformed multipart requests
  - CVE-2025-47935: DoS via memory leaks from unclosed streams
  - CVE-2025-48997: DoS from maliciously crafted upload requests
  - CVE-2025-7338: DoS via malformed upload request handling
- Upgraded multer from 1.4.5-lts.1 to 2.0.2 (no breaking changes)
- Fixed additional vulnerabilities: glob (high), js-yaml (moderate), jws (high)
- npm audit: 0 vulnerabilities in frontend and backend

### Changed
- Updated browserslist database (caniuse-lite) to latest version for current browser compatibility data

### Added
- MIT License for open source distribution
- Comprehensive DEPLOYMENT_OPTIONS.md covering Docker, Vercel + PaaS, and VPS deployment strategies
- Brand overlay system for white-label deployments with separate private repositories
- ACME brand example implementation for reference
- Brand-specific development notes guidance in CLAUDE.md
- Dependabot configuration for automated dependency security updates
- Parameterized remote deployment script (zive-brand/deploy-remote.sh) with branch selection

### Changed
- Compressed sample-reel-preview.mp4 from 70MB to 2.5MB (30 seconds, 540x960 resolution)
- Removed all client-specific references from public documentation
- Updated documentation structure with clearer deployment options
- Added license field to package.json files

### Removed
- Unused multer-s3 dependency and imports (system uses direct AWS SDK integration)

## [0.2.0] - 2024-10-16

### Security
- Updated Next.js from 15.3.2 to 15.5.2 to address multiple security vulnerabilities:
  - Fixed cache poisoning vulnerability (GHSA-r2fc-ccr8-96c4)
  - Fixed content injection for Image Optimization (GHSA-xv57-4mr9-wg8v)
  - Fixed SSRF via improper middleware redirect (GHSA-4342-x723-ch2f)
  - Fixed cache key confusion for image optimization (GHSA-g5qg-72qw-gw5v)
- Updated form-data from 4.0.1 to 4.0.4 in backend to fix critical security vulnerability (GHSA-fjxv-7rqg-78g4)
- Implemented comprehensive Phase 1 Security Fixes:
  - Strong JWT secret requirement (minimum 32 characters)
  - No default admin credentials - secure setup endpoint required
  - Password strength requirements (12+ characters with complexity)
  - Rate limiting on authentication endpoints (5 attempts per 15 minutes)
  - httpOnly cookies for JWT tokens

### Added - Phase 2 Architecture Improvements

#### Reliability & Performance
- Centralized error handling middleware with structured error responses
- Database connection pooling (10 max connections, 2 minimum)
- Exponential backoff retry logic for database connections (5 attempts)
- UUID-based correlation ID tracking for request tracing
- Centralized API client with automatic retry logic
- Request deduplication and intelligent caching (5-minute TTL)
- Comprehensive environment variable validation on startup
- React error boundaries with fallback UI
- Client error logging to server (`/api/client-error` endpoint)

#### Monitoring & Debugging
- Enhanced health check endpoints with dependency monitoring
- Frontend health check at `/api/health` with backend connectivity tests
- Database connection pool status monitoring
- Structured Winston logging with correlation IDs
- Component-specific child loggers (database, s3, auth, api, file)
- Real-time memory and resource tracking

#### White-Label & Branding
- Dynamic brand configuration system with runtime loading
- Brand overlay pattern with separate private git repositories
- Configurable theme colors, logos, and external links
- Environment-based brand selection

### Added - Phase 3 Code Quality & Performance
- Database indexes for improved query performance
- Bundle optimization and code splitting
- TypeScript strict mode compliance
- ESLint configuration improvements

### Added - Features
- Comprehensive help system with role-based documentation
- Visual button representations in help text
- Soft delete system with trash management (30-day retention)
- Trash toggle UI to show/hide deleted cards
- Restore functionality for deleted cards
- Permanent deletion for admin users
- Download tracking with `downloadCount` field
- Popularity sorting by download count
- Development-only download count overlay
- Multi-provider email system (SendGrid AND Mailgun support)
- Automatic email provider detection
- Forced email driver configuration option
- Enhanced password reset with 8-hour token expiration
- Login with username OR email (case-insensitive)

### Added - Video System
- Safari-specific video rendering with native controls
- Chrome/Firefox interactive preview with hover controls
- Mobile-optimized video playback across all browsers
- Signed URL downloads with Content-Disposition headers
- Direct S3 streaming URLs for optimal performance
- Browser-specific download button positioning

### Changed
- Frontend version bumped to 0.2.0
- Backend version bumped to 1.1.0
- Changed "user" role to "editor" throughout the system
- Added `isEditor` computed property in AuthContext
- Download buttons now always visible on touch devices
- Download buttons moved to consistent top-right position
- Eliminated double-tap requirement for downloads on mobile
- Refactored navigation to use reusable AppHeader component
- Consolidated hamburger menu logic across all routes

### Fixed
- TypeScript compatibility issues with Next.js 15.5.2
- Nullable searchParams in reset-password page
- Explicit any type usage in health check error handling
- MongoDB deprecated bufferMaxEntries option removed
- Safari video streaming with regional S3 URLs
- Mobile video autoplay and playback issues
- Safari hanging issues from DOM manipulation in download buttons
- Health check to use dynamic hostname in Docker containers

### Documentation
- Complete Phase 2 documentation updates
- WHITE_LABEL_GUIDE.md for brand customization
- BRAND_OVERLAY_GUIDE.md for private repository pattern
- Updated CLAUDE.md with comprehensive development workflow
- Added S3 URL format best practices
- Mail system abstraction documentation
- Soft delete system usage guide

## [0.1.0] - 2024-06-07

### Initial Release

#### Core Features
- Media management system with three card types (images, social posts, reels)
- Next.js 15 frontend with TypeScript and Tailwind CSS
- Express.js backend with MongoDB and Mongoose ODM
- User authentication with JWT tokens and httpOnly cookies
- Role-based access control (anonymous, editor, admin)
- Password hashing with scrypt

#### Storage & Infrastructure
- AWS S3 integration for cloud file storage
- Local filesystem fallback for development
- Storage abstraction layer for seamless switching
- S3 migration script for existing files
- Docker deployment configuration with nginx reverse proxy
- MongoDB connection with automatic retry logic

#### Media Features
- Image cards with preview and high-resolution download
- Social cards with image sequences and copy (PDF)
- Reel cards with video player and optional transcripts
- Tag-based categorization system
- Rich text editing for social media copy (TipTap)
- Infinite scroll for content browsing
- Advanced search and filtering

#### User Interface
- Mobile-responsive design
- Admin panel for user management
- Card creation, editing, and deletion interface
- File upload with validation
- Download functionality for all media types
- Anonymous browsing without authentication

#### Developer Experience
- TypeScript type safety throughout
- ESLint configuration
- Structured project organization
- Environment-based configuration
- Comprehensive README documentation

---

## Version History Summary

- **Unreleased**: Replace axios with native fetch, eslint minimatch fix
- **0.2.4** (2026-02-23): Security patch — backend qs/express/fast-xml-parser/axios, frontend next/lodash/ajv/markdown-it
- **0.2.3** (2026-02-23): Auto-adaptive header theming with WCAG luminance detection
- **0.2.2** (2025-12-12): Critical React Server Components security patches
- **0.2.1** (2025-12-12): React Server Components RCE patch, additional vulnerability fixes
- **0.2.0** (2024-10-16): Security updates, Phase 2 architecture improvements, white-labeling, feature additions
- **0.1.0** (2024-06-07): Initial release with core media management functionality
