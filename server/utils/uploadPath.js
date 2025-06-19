const path = require('path');

/**
 * Get the correct upload path based on environment configuration
 * @returns {string} The upload directory path
 */
function getUploadPath() {
  // Use UPLOAD_PATH env var if set (for Docker volumes)
  // Otherwise fall back to local uploads directory
  return process.env.UPLOAD_PATH || path.join(__dirname, '..', 'uploads');
}

module.exports = { getUploadPath };