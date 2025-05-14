/**
 * Media Management System Constants
 * Centralized configuration for video and image dimensions
 */

// Reel/video dimensions - portrait orientation (9:16 aspect ratio)
const VIDEO_DIMENSIONS = {
  WIDTH: 720,
  HEIGHT: 1280,
  ASPECT_RATIO: '9:16'
};

// Preview generation settings
const PREVIEW_SETTINGS = {
  // Extract the first frame (0 seconds) for thumbnails
  TIMESTAMP: '00:00:00.000',
  // Thumbnail quality for JPEG compression
  QUALITY: 90,
  // Directory where temporary files are stored
  TEMP_DIR: 'temp'
};

// S3 Storage settings
const S3_SETTINGS = {
  // S3 path prefix for all media files
  PATH_PREFIX: 'dams/',
  // Default content types
  CONTENT_TYPES: {
    JPEG: 'image/jpeg',
    MP4: 'video/mp4',
    PDF: 'application/pdf',
    TEXT: 'text/plain'
  }
};

// Export all constants
module.exports = {
  VIDEO_DIMENSIONS,
  PREVIEW_SETTINGS,
  S3_SETTINGS
};