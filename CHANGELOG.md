# Changelog

All notable changes to the Media Management System will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2025-08-30

### Security
- Updated Next.js from 15.3.2 to 15.5.2 to address multiple security vulnerabilities:
  - Fixed cache poisoning vulnerability (GHSA-r2fc-ccr8-96c4)
  - Fixed content injection for Image Optimization (GHSA-xv57-4mr9-wg8v)
  - Fixed SSRF via improper middleware redirect (GHSA-4342-x723-ch2f)
  - Fixed cache key confusion for image optimization (GHSA-g5qg-72qw-gw5v)
- Updated form-data from 4.0.1 to 4.0.4 in backend to fix critical security vulnerability (GHSA-fjxv-7rqg-78g4)

### Added
- Frontend health check endpoint at `/api/health` for monitoring container health
- Health check configuration in Docker for frontend container
- Comprehensive health monitoring including memory usage, backend connectivity, and response times

### Fixed
- TypeScript compatibility issues with Next.js 15.5.2:
  - Fixed nullable searchParams in reset-password page
  - Fixed explicit any type usage in health check error handling

### Changed
- Frontend version bumped to 0.2.0
- Backend version bumped to 1.1.0

## [0.1.0] - Previous Release

### Initial Features
- Media management system with support for images, social posts, and reels
- User authentication and role-based access control
- AWS S3 integration for file storage
- Docker deployment configuration
- Soft delete functionality with trash management
- Download tracking and popularity sorting
- Rich text editing for social media copy
- Mobile-responsive design