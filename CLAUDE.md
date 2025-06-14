# Claude Code Development Notes

## Project Overview
Media Management System - Next.js frontend with Express backend for managing digital media assets (images, social posts, reels).

## Key Architecture
- **Frontend**: Next.js 15 with TypeScript, Tailwind CSS
- **Backend**: Express.js with MongoDB, JWT auth
- **Storage**: AWS S3 with local fallback
- **Deployment**: Docker containers

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

# Push to master
git push origin master
```

### Docker Deployment to Dev Server
```bash
# SSH connection works with: ssh dev
# Project location: ~/projects/media-management-system

# Full deployment sequence:
ssh dev "cd ~/projects/media-management-system && git pull origin master"
ssh dev "cd ~/projects/media-management-system && docker compose down"
ssh dev "cd ~/projects/media-management-system && docker compose up --build -d"
ssh dev "cd ~/projects/media-management-system && docker compose ps"
```

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
```

## Recent Major Changes

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

## Testing Checklist

### Before Deployment
- [ ] Build completes successfully (`npm run build`)
- [ ] All routes accessible (/, /images, /posts, /reels, /help)
- [ ] Admin login works on all pages
- [ ] Download buttons visible on mobile
- [ ] Help documentation displays correctly for all user roles

### After Deployment
- [ ] Frontend container healthy (port 5000)
- [ ] Backend container healthy (port 5001)
- [ ] All API endpoints responding
- [ ] File uploads working
- [ ] Authentication functioning

## Environment Details

### Dev Server
- **SSH**: `ssh dev` 
- **Path**: `~/projects/media-management-system` ⚠️ **NOT** `/opt/media-management-system`
- **Frontend**: Port 5000 → 3000
- **Backend**: Port 5001 → 5001

**Important**: Project is in the user's home directory (`~/projects/`), not in `/opt/`

### Local Development
- **Frontend**: Port 3000
- **Backend**: Port 5001
- **MongoDB**: Configured via environment variables

### AWS S3 Configuration

**CORS Configuration Required for Downloads**

The S3 bucket (`zivepublic`) must have CORS configured to allow browser downloads from the lightbox. This enables the download button to fetch images and force downloads instead of opening in browser.

**Required CORS Configuration:**
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": [
      "Content-Length",
      "Content-Type",
      "Content-Disposition",
      "ETag",
      "Last-Modified"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

**How to Apply:**
1. AWS Console → S3 → `zivepublic` bucket
2. Permissions tab → Cross-origin resource sharing (CORS)
3. Edit and paste the configuration above

**Existing Bucket Policy** (preserve this):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::zivepublic/*"
    }
  ]
}
```

**Note**: CORS is required for lightbox downloads but doesn't affect other S3 access patterns.

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