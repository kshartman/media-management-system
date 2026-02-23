# Claude Code Development Notes

> **📚 Documentation Overview:**
> - **README.md**: Complete setup, configuration, and feature guide
> - **DEPLOYMENT_OPTIONS.md**: Deployment strategies (Docker, Vercel, VPS)
> - **DOCKER_DEPLOYMENT.md**: Production deployment with Docker and nginx
> - **WHITE_LABEL_GUIDE.md**: Brand customization for different clients
> - **BRAND_OVERLAY_GUIDE.md**: Private brand repository pattern
> - **CLAUDE.md** (this file): Development workflow and architecture reference

## ⚠️ Important: Brand-Specific Information

**This file contains GENERIC information only.** All examples use placeholders like:
- Domain: `media.example.com`
- S3 Bucket: `your-bucket-name`
- Server paths: generic examples

### Working on a Specific Brand Deployment?

**YOU MUST read the brand's private development notes first:**

```
<brand-name>-brand/DEVELOPMENT_NOTES.md
```

Each brand folder contains:
- **DEVELOPMENT_NOTES.md**: Brand-specific configuration, domains, S3 buckets, deployment commands
- **deploy.sh**: Brand-specific deployment script
- **env/**: Encrypted environment files with real credentials
- **config/**: Brand configuration files

**Example:**
- For Zive deployment → Read `zive-brand/DEVELOPMENT_NOTES.md`
- For ACME deployment → Read `acme-brand/DEVELOPMENT_NOTES.md`

Without reading the brand-specific notes, you will not have:
- Actual domain names
- Real S3 bucket names
- SSH connection details
- Deployment server paths
- Client-specific configuration

**This file + Brand's DEVELOPMENT_NOTES.md = Complete picture**

---

## Project Overview
Media Management System - Next.js frontend with Express backend for managing digital media assets (images, social posts, reels).

## Key Architecture
- **Frontend**: Next.js 15 with TypeScript, Tailwind CSS
- **Backend**: Express.js with MongoDB, JWT auth
- **Storage**: AWS S3 with local fallback (configurable)
- **Email**: SendGrid or Mailgun (configurable)
- **Database**: MongoDB only (no alternatives currently supported)
- **Deployment**: Multiple options - Docker, Vercel + PaaS, VPS, etc.

## Phase 2 Architecture Improvements

### Backend Infrastructure
- **Centralized Error Handling**: Custom middleware with structured error responses
- **Correlation ID Tracking**: UUID-based request tracing throughout the system
- **Database Resilience**: Connection pooling (10 max, 2 min) with exponential backoff retry
- **Environment Validation**: Comprehensive startup validation of all environment variables
- **Structured Logging**: Winston-based logging with correlation IDs and component-specific loggers

### Frontend Enhancements
- **Error Boundaries**: React error boundaries with fallback UI and server error logging
- **Centralized API Client**: Retry logic, request deduplication, intelligent caching
- **Enhanced Error Handling**: Automatic session management and user-friendly error messages

### Reliability Features
- **Request Retry Logic**: Exponential backoff with jitter for network resilience
- **Connection Monitoring**: Real-time database connection health tracking
- **Client Error Logging**: Automatic logging of frontend errors to backend for debugging
- **Health Check Enhancements**: Dependency monitoring for database, storage, and email services

## Development Commands

### Local Development
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Run linting
npm run lint

# Run type checking  
npm run typecheck
```

### Git Workflow
```bash
# Check status
git status

# Stage all changes
git add .

# Commit with detailed message
git commit -m "descriptive message"

# Push to main
git push origin main
```

### Brand Deployment
```bash
# Deploy a specific brand (handles brand setup, build, and deploy)
./deploy.sh zive        # Zive: sets up brand, scp to dev server, build + restart
./deploy.sh superpatch  # Super Patch: sets up brand, local build, ECR push, VPS pull
```

⚠️ **Always use `deploy.sh` or manually set up the brand before building.** The build directory is shared — leftover config from another brand will deploy the wrong brand. See `<brand>-brand/DEVELOPMENT_NOTES.md` for manual steps.

## Component Architecture

### Header System
- **AppHeader**: Reusable header component with hamburger menu
- **Navigation**: Tab navigation (All, Images, Posts, Reels, Help)
- Used across all routes for consistency

### Authentication
- **AuthContext**: Provides `user`, `isAuthenticated`, `isAdmin`, `login`, `logout`
- **Login Modal**: Handled per-page, triggered via AppHeader callback

### Card Types
- **ImageCard**: Single image with download
- **SocialCard**: Image sequences with social copy
- **ReelCard**: Videos with transcripts and social copy

## User Roles & Permissions

### Anonymous Users
- Browse and download all media
- Access help documentation

### Authenticated Users  
- All anonymous features
- Create, edit, delete cards
- Upload media files

### Admin Users
- All user features
- User management (create, edit, delete users)
- Access admin panel

## File Structure
```
src/
├── app/                    # Next.js App Router pages
│   ├── help/              # Help system
│   ├── images/            # Image cards page
│   ├── posts/             # Social cards page  
│   └── reels/             # Reel cards page
├── components/
│   ├── admin/             # Admin components
│   ├── auth/              # Authentication
│   ├── cards/             # Card components
│   ├── filters/           # Search/filter UI
│   ├── help/              # Help documentation
│   ├── layout/            # Layout components
│   └── ui/                # Reusable UI components
└── lib/                   # Utilities and API functions
    ├── api-v2.ts          # Enhanced API client with retry logic
    ├── apiClient.ts       # Centralized HTTP client
    └── authContext.tsx    # Authentication context
```

## New Infrastructure Components

### Server Middleware
```
server/middleware/
├── correlationId.js       # UUID correlation ID middleware
└── errorHandler.js        # Centralized error handling
```

### Server Utilities
```
server/utils/
├── envValidator.js        # Environment variable validation
├── healthCheck.js         # Enhanced health monitoring (updated)
└── logger.js              # Structured logging (enhanced)
```

### Frontend Error Handling
```
src/components/
├── ErrorBoundary.tsx      # Generic React error boundary
└── CardErrorBoundary.tsx  # Card-specific error handling
```

## API Architecture Patterns

### Centralized API Client (`src/lib/apiClient.ts`)
- **Automatic Retry Logic**: Exponential backoff with jitter (max 5 retries)
- **Request Deduplication**: Prevents duplicate GET requests
- **Intelligent Caching**: 5-minute TTL for GET responses
- **Error Handling**: Standardized error classes and correlation ID tracking
- **Timeout Management**: 30-second default timeout with circuit breaker patterns

### Enhanced API Layer (`src/lib/api-v2.ts`)
- **Type-Safe Responses**: Full TypeScript support with proper error types
- **Automatic Session Management**: Handles 401 responses and redirects
- **MongoDB ID Mapping**: Automatic `_id` to `id` conversion for client compatibility
- **Cache Invalidation**: Smart cache busting for admin operations

### Error Handling Architecture
- **Correlation IDs**: Every request/response includes unique tracking ID
- **Structured Responses**: Consistent error format with timestamps and paths
- **Client Error Logging**: React errors automatically logged to `/api/client-error`
- **Custom Error Classes**: `APIError`, `ValidationError`, `AuthenticationError`, etc.

### Database Architecture Improvements
- **Connection Pooling**: 10 max connections, 2 minimum with smart scaling
- **Retry Logic**: 5 attempts with exponential backoff for connection failures
- **Health Monitoring**: Real-time connection status and pool metrics
- **Graceful Degradation**: Non-retryable error detection (auth failures, etc.)

## Recent Major Changes

### Version 0.2.4 - Security Patches (Latest)
- Backend: `qs`/`express` arrayLimit DoS, `fast-xml-parser` 3 DoS/bypass issues, `axios` `__proto__` DoS
- Frontend: `next` 15.5.9→15.5.12 (2 DoS advisories), `lodash` prototype pollution, `ajv` ReDoS, `markdown-it` ReDoS
- Backend: 0 vulnerabilities. Frontend: 13 remaining (dev-only eslint/minimatch)
- Added `deploy.sh` brand deployment script, fixed brand setup procedures
- See CHANGELOG.md for full CVE/GHSA details

### Version 0.2.3 - Auto-Adaptive Header Theming
- Added WCAG luminance-based auto-detection of light vs dark header backgrounds
- Header text, icons, nav tabs, and borders now auto-adapt to any `headerBackground` color
- New optional `headerColors` sub-object in `BrandConfig.theme` for per-brand overrides
- Dark headers (e.g. Super Patch `#A10000`) get white/rgba-white text automatically
- Light headers (e.g. default, Zive, Vinia) compute to equivalent Tailwind gray values — no visual change
- Nav tab hover states driven by CSS custom properties for compatibility with inline styles
- **Files changed**: `types.ts`, `config/index.ts`, `AppHeader.tsx`, `Navigation.tsx`, `globals.css`
- **No brand config files changed** — all existing brands auto-compute correct values

**Maintaining exact previous behavior:**
If a brand needs pixel-identical colors to the pre-0.2.3 hardcoded values, add explicit `headerColors` overrides in the brand config's `theme` object. The auto-computed light-header defaults match Tailwind gray-900/700/600/200 values, but two elements shifted slightly:
- Avatar icon: was `text-gray-600` (`#4b5563`), now inherits `textMuted` (`#374151` / gray-700)
- Hamburger button: lost CSS hover darkening (gray-700 → gray-900) since inline styles override Tailwind hover classes

To restore exact old behavior for any brand, add to its config:
```typescript
theme: {
  // ... existing colors ...
  headerColors: {
    textMuted: '#4b5563', // restore gray-600 for icons
  },
}
```

### Version 0.2.0 - Security Updates
- Updated Next.js from 15.3.2 to 15.5.2 to fix moderate security vulnerabilities
  - Fixed cache poisoning vulnerability
  - Fixed content injection for Image Optimization
  - Fixed SSRF via improper middleware redirect
  - Fixed cache key confusion for image optimization
- Updated form-data from 4.0.1 to 4.0.4 in backend to fix critical vulnerability
- Added frontend health check endpoint at `/api/health`
- Added health check to Docker configuration for frontend container
- Fixed TypeScript compatibility issues with Next.js 15.5.2

## Previous Major Changes

### Phase 2 Architecture Overhaul (Latest)
- Implemented centralized error handling middleware with correlation ID tracking
- Added database connection pooling and retry logic with exponential backoff
- Created React error boundaries for component-level error handling
- Built centralized API client with request deduplication and intelligent caching
- Enhanced health checks with dependency monitoring and connection pool status
- Added comprehensive environment validation on server startup
- Migrated all components from legacy `api.ts` to new `api-v2.ts` architecture

### Help System Implementation
- Created comprehensive role-based help documentation
- Added visual button representations in help text
- Integrated help into all navigation menus

### Mobile UX Improvements
- Made download buttons always visible on touch devices
- Moved all download buttons to consistent top-right position
- Eliminated double-tap requirement for downloads

### Navigation Refactoring
- Created reusable AppHeader component
- Consolidated hamburger menu logic
- Added help link to all routes

### Role System Update
- Changed "user" role to "editor" throughout the system
- Added isEditor computed property in AuthContext
- Editors can create, edit, delete cards (same as old "user" role)
- Admins have additional user management capabilities

### Download Tracking Implementation
- Added downloadCount field to Card model
- Implemented track-download API endpoint
- Added popularity sort option (by download count)
- Added development-only download count overlay on cards

### Video System Overhaul
- **Browser Detection**: Safari vs Chrome rendering paths
- **Safari**: Native video controls with positioned download button
- **Chrome/Firefox**: Interactive preview with hover download button
- **Mobile**: Native controls across all browsers for touch interface
- **Downloads**: Signed URLs with Content-Disposition headers for reliable downloads
- **Streaming**: Direct S3 URLs preserved for optimal video performance

### Mail System Abstraction
- Abstracted email service to support multiple providers
- Added Mailgun driver alongside existing SendGrid
- Automatic driver detection based on configuration
- Enhanced health check to show mail system status

### Soft Delete System Implementation
- Added soft delete functionality for cards (admin/editor only)
- Cards marked as deleted rather than permanently removed
- Trash toggle in UI to show/hide deleted cards
- Restore functionality to bring back deleted cards
- Permanent delete option for cards already in trash
- Automatic cleanup after 30 days (configurable retention period)
- Added deletedAt and deletedBy tracking fields
- Updated API to support includeDeleted parameter for admin/editor users

## Common Issues & Solutions

### Safari Hanging
- **Cause**: DOM manipulation in download buttons
- **Solution**: Use natural anchor behavior instead of manual DOM creation

### Mobile Download UX
- **Issue**: Hover-only download buttons on mobile
- **Solution**: Use `opacity-100 sm:opacity-0 sm:group-hover:opacity-100`

### Build Errors
- **Webpack modules**: Clear `.next` cache and restart dev server
- **Media queries**: Use standard Tailwind responsive classes

### API & Network Issues
- **Correlation ID Tracking**: All API responses include `X-Correlation-ID` header for debugging
- **Client Errors**: Check `/api/client-error` logs for React error boundary reports
- **Connection Pool**: Monitor database connection pool status via `/api/health`
- **Request Retries**: Failed requests automatically retry with exponential backoff (max 5 attempts)

### Debugging with Correlation IDs
- **Server Logs**: All logs include correlation IDs for request tracing
- **Client Errors**: Error boundaries automatically log errors with correlation IDs
- **Health Monitoring**: Use `/api/health` to check system status and connection pool metrics
- **Environment Issues**: Server validates all environment variables on startup

## Testing Checklist

### Before Deployment
- [ ] Build completes successfully (`npm run build`)
- [ ] All routes accessible (/, /images, /posts, /reels, /help)
- [ ] Admin login works on all pages
- [ ] Download buttons visible on mobile
- [ ] Help documentation displays correctly for all user roles
- [ ] Error boundaries working (test with intentional React errors)
- [ ] API client retry logic functioning
- [ ] Environment validation passes on startup

### After Deployment
- [ ] Frontend container healthy (port 5000)
- [ ] Backend container healthy (port 5001)
- [ ] All API endpoints responding with correlation IDs
- [ ] File uploads working
- [ ] Authentication functioning
- [ ] Database connection pool operational (`/api/health`)
- [ ] Client error logging working (`/api/client-error`)
- [ ] Correlation ID tracking in server logs
- [ ] Environment validation on server startup

### Security Testing

**Test JWT Secret Validation:**
- [ ] Server fails to start with missing JWT_SECRET
- [ ] Server fails to start with weak JWT_SECRET (< 32 chars)
- [ ] Server starts successfully with strong JWT_SECRET

**Test Setup Flow:**
- [ ] Fresh database shows setup instructions in logs
- [ ] Setup endpoint `/api/auth/setup` works only when no users exist
- [ ] Setup fails with weak password (test validation)
- [ ] Setup succeeds with strong password and creates admin user
- [ ] Setup fails when attempted again after user exists

**Test Rate Limiting:**
```bash
# Make multiple rapid login attempts - should get 429 responses
for i in {1..10}; do
  curl -X POST http://localhost:5001/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"wrong"}' \
    -v
done
```

**Test File Upload Security:**
- [ ] Try uploading suspicious files (.exe, .php, .js) - should be blocked
- [ ] Try uploading files with mismatched MIME types - should be rejected
- [ ] Verify only allowed file types are accepted

**Test Cookie Authentication:**
- [ ] Login successfully creates `auth_token` cookie with httpOnly flag
- [ ] JWT token not accessible via `document.cookie` in browser console
- [ ] Cookies have proper security flags (httpOnly, secure in prod, sameSite)

**Test Password Requirements:**
- [ ] Passwords require minimum 12 characters
- [ ] Passwords require uppercase, lowercase, numbers, and special characters
- [ ] Common passwords are rejected

## Environment Details

### Dev Server
- **SSH**: `ssh dev` 
- **Path**: `~/projects/media-management-system` ⚠️ **NOT** `/opt/media-management-system`
- **Frontend**: Port 5000 → 3000
- **Backend**: Port 5001 → 5001

**Important**: Project is in the user's home directory (`~/projects/`), not in `/opt/`

### Local Development
- **Frontend**: Port 3000
- **Backend**: Port 3001 (Note: Different from Docker which uses 5001)
- **MongoDB**: Configured via environment variables

### AWS S3 Configuration

**Video Streaming and Download Configuration**

The S3 bucket supports both video streaming (direct URLs) and reliable downloads (signed URLs with Content-Disposition headers).

**CORS Configuration for Video Streaming:**
```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": [
      "Content-Length",
      "Content-Range",
      "Accept-Ranges",
      "Content-Type"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

**Download System:**
- **Video streaming**: Direct S3 URLs for optimal performance
- **Downloads**: Server-generated signed URLs with `ResponseContentDisposition: attachment`
- **Browser compatibility**: Signed URLs bypass cross-origin download restrictions
- **Safari/Chrome**: Browser-specific rendering with native vs interactive controls

**How to Apply CORS:**
1. AWS Console → S3 → your bucket
2. Permissions tab → Cross-origin resource sharing (CORS)
3. Edit and paste the configuration above

**Example Bucket Policy** (adjust for your bucket name):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    }
  ]
}
```

**Note**: CORS enables video streaming. Downloads use signed URLs to ensure reliability across all browsers.

### S3 URL Format Best Practice
**Important**: Always use regional S3 URLs for better reliability.
- ❌ Global format: `https://bucket.s3.amazonaws.com/...` (may cause 403 errors)
- ✅ Regional format: `https://bucket.s3.region.amazonaws.com/...` (recommended)

**Solution**: S3 storage configuration automatically generates regional URLs for new uploads. Database migration script available at `server/scripts/migrate-s3-urls.js` if needed for existing URLs.

## Code Patterns

### Component Props
- Always include TypeScript interfaces
- Use optional props with defaults
- Pass callbacks for event handling

### State Management
- Use React Context for global state (auth)
- Local state for component-specific data
- Proper cleanup in useEffect hooks

### Styling
- Tailwind CSS for all styling
- Responsive design first
- Consistent color scheme (blue primary, purple admin)

## Maintenance Notes

### Regular Tasks
- Keep dependencies updated
- Monitor container health
- Review and clean up unused code
- Update help documentation for new features

### Performance
- Optimize images before upload
- Use Next.js Image component
- Lazy load heavy components
- Monitor bundle size