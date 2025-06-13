/**
 * Utility for cleaning up orphaned files
 */
const fs = require('fs');
const path = require('path');
const { deleteFile, isFileOrphaned } = require('./s3Storage');
const logger = require('./logger');

// Create child logger for cleanup operations
const cleanup = logger.child({ module: 'cleanup' });

// How long to keep temporary zip files before cleanup (24 hours in milliseconds)
const ZIP_FILE_EXPIRY = 24 * 60 * 60 * 1000; 

/**
 * Clean up orphaned ZIP files that are older than the expiry time
 * These are temporary files created for downloading image sequences
 */
async function cleanupOrphanedZipFiles() {
  try {
    cleanup.info('Running orphaned ZIP file cleanup...');
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    
    // Read all files in the uploads directory
    const files = fs.readdirSync(uploadsDir);
    
    // Filter for ZIP files
    const zipFiles = files.filter(file => file.endsWith('.zip'));
    cleanup.debug(`Found ${zipFiles.length} ZIP files to check`);
    
    const now = Date.now();
    let deletedCount = 0;
    
    for (const zipFile of zipFiles) {
      try {
        const filePath = path.join(uploadsDir, zipFile);
        const stats = fs.statSync(filePath);
        
        // Check if file is older than expiry time
        const fileAge = now - stats.mtimeMs;
        
        if (fileAge > ZIP_FILE_EXPIRY) {
          cleanup.info(`Deleting expired ZIP file: ${zipFile} (${Math.round(fileAge / (60 * 60 * 1000))} hours old)`);
          
          // Delete the file
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      } catch (fileError) {
        cleanup.error(`Error processing ZIP file ${zipFile}:`, fileError);
      }
    }
    
    cleanup.info(`Cleaned up ${deletedCount} orphaned ZIP files`);
  } catch (error) {
    cleanup.error('Error cleaning up orphaned ZIP files:', error);
  }
}

module.exports = { cleanupOrphanedZipFiles };