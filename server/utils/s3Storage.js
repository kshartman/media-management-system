const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const multerS3 = require('multer-s3');
const logger = require('./logger');
require('dotenv').config();

// Create a child logger for s3Storage
const s3StorageLogger = logger.child({ component: 's3Storage' });

// Extract S3 configuration from environment variables
const useS3Storage = process.env.USE_S3_STORAGE === 'true';
const s3Config = {
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
};
const bucketName = process.env.S3_BUCKET;
const s3CustomDomain = process.env.S3_CUSTOM_DOMAIN;

// Initialize S3 client if using S3 storage
const s3Client = useS3Storage ? new S3Client(s3Config) : null;

// Determine storage type based on environment variable
const isS3Configured = useS3Storage && s3Client && bucketName;

// S3 folder path
const s3FolderPath = 'dams';

// Configure storage engine to always store locally first
const getStorage = () => {
  // Always use local storage initially
  s3StorageLogger.info(isS3Configured ? 
    'Using local storage first, then uploading to S3' :
    'Using local file storage only');
  
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(__dirname, '..', 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      // Sanitize the original filename to be safe for storage
      const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');

      // Use a timestamp prefix and a random string to guarantee uniqueness
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 8);
      const fileName = `${timestamp}-${randomString}-${sanitizedName}`;

      // Store original filename in metadata for display
      if (req.fileOriginalNames === undefined) {
        req.fileOriginalNames = {};
      }
      req.fileOriginalNames[file.fieldname] = sanitizedName;

      s3StorageLogger.debug(`Generating unique filename for upload: ${fileName}`);
      cb(null, fileName);
    },
  });
};

// Get file URL (S3 or local)
const getFileUrl = (filename) => {
  if (!filename) return null;

  // Handle URL if it already includes http:// or https://
  if (filename.startsWith('http://') || filename.startsWith('https://')) {
    return filename;
  }

  // Remove any leading slashes for consistency
  const cleanFilename = filename.startsWith('/') ? filename.substring(1) : filename;

  // If using S3, generate an S3 URL
  if (isS3Configured) {
    // Check if filename already includes the folder path
    const fullPath = cleanFilename.includes(s3FolderPath)
      ? cleanFilename
      : `${s3FolderPath}/${cleanFilename}`;

    // If a custom domain is configured, use it
    if (s3CustomDomain) {
      return `https://${s3CustomDomain}/${fullPath}`;
    }

    // Otherwise use the standard S3 URL format
    return `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${fullPath}`;
  }

  // For local storage, return a path that the web server can serve
  return `/uploads/${path.basename(cleanFilename)}`;
};

// Generate a pre-signed URL for temporary access to a file
const getSignedFileUrl = async (filename, expirationSeconds = 3600) => {
  if (!isS3Configured || !filename) return null;

  try {
    let key;
    
    // Handle full S3 URLs - extract just the key part
    if (filename.includes('amazonaws.com/')) {
      key = filename.split('amazonaws.com/')[1];
    }
    // Handle custom domain URLs
    else if (s3CustomDomain && filename.includes(s3CustomDomain)) {
      key = filename.split(`${s3CustomDomain}/`)[1];
    }
    // Handle local paths that might have uploads/ prefix
    else if (filename.includes('uploads/')) {
      const baseName = filename.split('uploads/')[1];
      key = `${s3FolderPath}/${baseName}`;
    }
    // Handle paths that already have the S3 folder prefix
    else if (filename.startsWith(s3FolderPath + '/')) {
      key = filename;
    }
    // Handle simple filenames
    else {
      // Remove any leading slashes for consistency
      const cleanFilename = filename.startsWith('/') ? filename.substring(1) : filename;
      // Add the S3 folder prefix if it's not already there
      key = cleanFilename.includes(s3FolderPath) ? cleanFilename : `${s3FolderPath}/${cleanFilename}`;
    }
    
    // Create a GetObject command
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    // Generate a signed URL
    return await getSignedUrl(s3Client, command, { expiresIn: expirationSeconds });
  } catch (error) {
    s3StorageLogger.error('Error generating signed URL:', error);
    return null;
  }
};

// Delete a file (from S3 or local storage)
const deleteFile = async (filename) => {
  if (!filename) return false;

  // Remove any leading slashes for consistency
  const cleanFilename = filename.startsWith('/') ? filename.substring(1) : filename;

  try {
    // If using S3, delete from S3 bucket
    if (isS3Configured) {
      let key;

      // For S3 URLs, extract just the key part (including folder)
      if (cleanFilename.includes('amazonaws.com/')) {
        key = cleanFilename.split('amazonaws.com/')[1];
      } else if (cleanFilename.includes('uploads/')) {
        // For local paths that are being migrated
        const baseName = cleanFilename.split('uploads/')[1];
        key = `${s3FolderPath}/${baseName}`;
      } else if (cleanFilename.startsWith(s3FolderPath + '/')) {
        // If the path already includes the folder
        key = cleanFilename;
      } else {
        // For any other case, add the folder prefix
        key = `${s3FolderPath}/${cleanFilename}`;
      }

      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      await s3Client.send(command);
      return true;
    } else {
      // For local storage, delete the file from disk
      const filePath = path.join(__dirname, '..', 'uploads', path.basename(cleanFilename));

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    }
  } catch (error) {
    s3StorageLogger.error(`Error deleting file ${filename}:`, error);
    return false;
  }
};

// Extract the filename from a URL or path
const getFilenameFromUrl = (url) => {
  if (!url) return null;

  try {
    let fullPath;

    // Handle S3 URLs
    if (url.includes('amazonaws.com/')) {
      fullPath = url.split('amazonaws.com/')[1];
    }
    // Handle custom domain URLs
    else if (s3CustomDomain && url.includes(s3CustomDomain)) {
      fullPath = url.split(`${s3CustomDomain}/`)[1];
    }
    // Handle local URLs
    else if (url.includes('uploads/')) {
      return path.basename(url);
    }
    // Default fallback
    else {
      return path.basename(url);
    }

    // For S3 URLs, preserve the folder structure
    if (isS3Configured) {
      return fullPath;
    }

    // For local paths or non-S3 environments, just return the filename
    return path.basename(fullPath);
  } catch (error) {
    s3StorageLogger.error('Error extracting filename from URL:', error);
    return null;
  }
};

/**
 * Checks if a file is orphaned (not referenced by any card in the database)
 * @param {string} fileUrl - The URL or path of the file to check
 * @param {object} Card - The Mongoose Card model
 * @returns {Promise<boolean>} - True if the file is orphaned, false if it's still referenced
 */
const isFileOrphaned = async (fileUrl, Card) => {
  if (!fileUrl) return true;

  try {
    // Clean the URL to handle different formats consistently
    const cleanFileUrl = fileUrl;

    // Search for references to this file in any card
    const referencingCard = await Card.findOne({
      $or: [
        { preview: cleanFileUrl },
        { download: cleanFileUrl },
        { movie: cleanFileUrl },
        { transcript: cleanFileUrl }
      ]
    });

    // If no card references this file, it's orphaned
    return !referencingCard;
  } catch (error) {
    s3StorageLogger.error(`Error checking if file ${fileUrl} is orphaned:`, error);
    // Assume it's not orphaned if there's an error (safer approach)
    return false;
  }
};

/**
 * Safely deletes a file if it's orphaned
 * @param {string} fileUrl - The URL or path of the file to check and delete
 * @param {object} Card - The Mongoose Card model
 * @returns {Promise<boolean>} - True if the file was deleted, false otherwise
 */
const safeDeleteOrphanedFile = async (fileUrl, Card) => {
  try {
    // Check if the file is orphaned
    const orphaned = await isFileOrphaned(fileUrl, Card);

    if (orphaned) {
      // File is orphaned, safe to delete
      s3StorageLogger.info(`File ${fileUrl} is orphaned, deleting...`);
      await deleteFile(fileUrl);
      return true;
    } else {
      // File is still referenced by at least one card
      s3StorageLogger.info(`File ${fileUrl} is still referenced by at least one card, not deleting`);
      return false;
    }
  } catch (error) {
    s3StorageLogger.error(`Error safely deleting file ${fileUrl}:`, error);
    return false;
  }
};

/**
 * Uploads a local file to S3 and returns the S3, URL
 * @param {string} localFilePath - Full path to the local file
 * @param {string} customFilename - Optional custom filename to use in S3
 * @returns {Promise<string|null>} - The S3 URL if successful, null if failed
 */
const uploadLocalFileToS3 = async (localFilePath, customFilename = null) => {
  if (!isS3Configured || !localFilePath) return null;
  
  try {
    s3StorageLogger.info(`Uploading local file ${localFilePath} to S3...`);
    
    // Check if the file exists
    if (!fs.existsSync(localFilePath)) {
      s3StorageLogger.error(`File ${localFilePath} does not exist`);
      return null;
    }
    
    // Read the file
    const fileContent = fs.readFileSync(localFilePath);
    const contentType = getContentTypeFromFilename(localFilePath);
    
    // Use custom filename or extract from path
    let filename = customFilename || path.basename(localFilePath);
    
    // Ensure we have the S3 folder prefix
    const s3Key = `${s3FolderPath}/${filename}`;
    
    // Create S3 upload parameters
    const uploadParams = {
      Bucket: bucketName,
      Key: s3Key,
      Body: fileContent,
      ContentType: contentType
    };
    
    // Upload to S3
    s3StorageLogger.info(`Uploading to S3: ${bucketName}/${s3Key} (${contentType})`);
    const command = new PutObjectCommand(uploadParams);
    await s3Client.send(command);
    
    // Return the S3 URL
    if (s3CustomDomain) {
      return `https://${s3CustomDomain}/${s3Key}`;
    }
    return `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
  } catch (error) {
    s3StorageLogger.error(`Error uploading ${localFilePath} to S3:`, error);
    return null;
  }
};

/**
 * Determines content type based on file extension
 * @param {string} filename - The filename to check
 * @returns {string} - The content type
 */
const getContentTypeFromFilename = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  
  // Common content types
  const contentTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.webm': 'video/webm',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.json': 'application/json',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
  };
  
  return contentTypes[ext] || 'application/octet-stream';
};

module.exports = {
  getStorage,
  getFileUrl,
  getSignedFileUrl,
  deleteFile,
  getFilenameFromUrl,
  isS3Configured,
  isFileOrphaned,
  safeDeleteOrphanedFile,
  uploadLocalFileToS3,
};