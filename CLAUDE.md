# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Media Management System built with Next.js as the frontend and Express.js as the backend. It allows users to browse, categorize, and manage digital media assets like images, social posts, and video reels.

## Repository Structure

- `/src` - Frontend Next.js application
  - `/app` - Next.js app router components
  - `/components` - React components organized by feature/type
  - `/lib` - Utilities, contexts, and API functions
  - `/types` - TypeScript type definitions
- `/server` - Express.js backend
  - `index.js` - Main server entry point
  - `/uploads` - Storage for uploaded media files
- `/public` - Static assets
- `/new-media-management` - Appears to be a parallel version of the system (WIP)

## Commands

### Development

Run the frontend:
```bash
npm run dev
```

Run the backend:
```bash
cd server
npm run dev
```

Build the frontend for production:
```bash
npm run build
```

Start the production frontend:
```bash
npm run start
```

Lint the frontend code:
```bash
npm run lint
```

### Utilities

Download sample media files for testing:
```bash
./download-samples.sh
```

## System Architecture

### Backend (Express.js)

The backend is a RESTful API server that:
1. Serves media files from the `/uploads` directory
2. Handles file uploads with multer
3. Manages authentication with JWT tokens
4. Provides CRUD operations for media cards
5. Supports filtering and pagination of media content
6. Currently uses in-memory data storage (would need a database in production)

Key endpoints:
- `/api/auth/login` - Authentication
- `/api/cards` - CRUD operations for media cards
- `/api/tags` - Get all available tags

### Frontend (Next.js)

The frontend is a responsive React application that:
1. Shows a grid of media cards
2. Supports filtering by media type, tags, and search queries
3. Implements infinite scrolling
4. Provides admin login for content management
5. Uses Material Tailwind components for UI

Key components:
- `CardFactory` - Factory pattern for rendering different card types
- `ImageCard`, `SocialCard`, `ReelCard` - Specific card implementations
- `FilterSidebar` - Filtering interface
- `CardGrid` - Main content display with infinite scrolling
- `AdminBar` - Admin controls
- `CardForm` - Form for adding/editing cards

### Authentication

The system uses JWT tokens for authentication:
1. Admin users can log in via the login form
2. JWT token is stored in localStorage
3. Protected routes/operations check for valid token
4. The frontend maintains auth state in the AuthContext

### Media Card Types

There are three card types with different properties:
1. **Image** - Contains preview and downloadable images
2. **Social** - Contains preview image and document copy (PDF)
3. **Reel** - Contains thumbnail, video file, and transcript

## Development Workflow

When adding features or fixing bugs:

1. Understand which part of the system is affected (frontend or backend)
2. For frontend changes:
   - Find the relevant components in `/src/components`
   - Update types in `/src/types` if needed
   - Use TypeScript for type safety
3. For backend changes:
   - Modify the Express routes in `server/index.js`
   - Test API endpoints with the frontend

For new media types:
1. Add type definition in `/src/types/index.ts`
2. Create a new card component in `/src/components/cards/`
3. Update `CardFactory` to handle the new type
4. Update `CardForm` for admin uploading
5. Modify server-side handlers

## Testing

The project doesn't currently have automated tests configured. Manual testing can be performed by:

1. Running both the frontend and backend
2. Using the admin login (username: admin, password: admin123)
3. Testing CRUD operations on media cards
4. Verifying filters work correctly
5. Testing infinite scrolling