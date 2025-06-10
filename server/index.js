const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const util = require('util');
const sharp = require('sharp');
const sizeOf = require('image-size');
const { connectToDatabase } = require('./db/connection');
const { Card, User, Tag } = require('./models');
const { getStorage, getFileUrl, getSignedFileUrl, deleteFile, getFilenameFromUrl,
  isS3Configured, safeDeleteOrphanedFile, uploadLocalFileToS3, isFileOrphaned } = require('./utils/s3Storage');
const { extractVideoFrame, getVideoMetadata } = require('./utils/videoUtils');
const { generateAndUploadPreview } = require('./generatePreview');
const { processImageSequence } = require('./processImageSequence');
const { createCardZip } = require('./utils/zipCardFiles');
const { cleanupOrphanedZipFiles } = require('./utils/cleanupOrphanedFiles');
const { VIDEO_DIMENSIONS } = require('./utils/mediaConstants');
require('dotenv').config();

/**
 * Process a file and return its path
 * 1. Files are always stored locally first (handled by multer)
 * 2. Process file locally (extract metadata, generate thumbnails, etc.)
 * 3. If S3 is configured, upload to S3 after processing - but only when told to do so
 * 4. Return the appropriate path for storage in the database
 *
 * @param {object} file - The multer file object
 * @param {object} options - Additional options
 * @param {boolean} options.uploadToS3 - Whether to upload to S3 (default: depends on isS3Configured)
 * @param {boolean} options.isVideo - Whether this is a video file (for special handling)
 * @param {boolean} options.skipS3Upload - Whether to skip S3 upload completely, regardless of config
 * @returns {Promise<string>} - The file path to store in the database
 */
const processFileAndGetPath = async (file, options = {}) => {
  if (!file) return null;

  console.log(`Processing file:`, {
    originalname: file.originalname,
    filename: file.filename,
    mimetype: file.mimetype,
    size: file.size,
    fieldname: file.fieldname,
    options: JSON.stringify(options)
  });

  // Get the local file path (multer always stores locally now)
  const localFilePath = path.join(__dirname, 'uploads', file.filename);
  let dbPath = `/uploads/${file.filename}`;
  
  // Special handling for videos - always keep local first for processing
  if (options.isVideo) {
    console.log(`Keeping video ${file.filename} local for processing first`);
    return dbPath;
  }
  
  // If instructed to skip S3 upload, return local path
  if (options.skipS3Upload) {
    console.log(`Skipping S3 upload for ${file.filename} as requested`);
    return dbPath;
  }
  
  // If S3 is configured and we should upload to S3, do so after processing
  if (isS3Configured && options.uploadToS3 !== false) {
    try {
      // Upload to S3
      console.log(`Uploading ${file.filename} to S3...`);
      const s3Url = await uploadLocalFileToS3(localFilePath);
      
      if (s3Url) {
        console.log(`Uploaded ${file.fieldname} to S3: ${s3Url}`);
        // Return the S3 URL for database storage
        dbPath = s3Url;
        
        // Clean up the local file after successful S3 upload
        try {
          if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
            console.log(`Deleted local file ${localFilePath} after S3 upload`);
          }
        } catch (cleanupError) {
          console.error(`Error cleaning up local file ${localFilePath}:`, cleanupError);
          // Continue even if cleanup fails - file will be stored in S3
        }
      } else {
        console.error(`Failed to upload ${file.fieldname} to S3, using local path instead`);
        // Keep the local path if S3 upload failed
      }
    } catch (error) {
      console.error(`Error uploading ${file.fieldname} to S3:`, error);
    }
  }

  return dbPath;
};

/**
 * Process a video file and generate preview
 * 1. Keep the video file locally
 * 2. Generate preview from the local file
 * 3. Upload both to S3 if configured
 * 4. Return paths for both video and preview
 * 
 * @param {object} file - The multer file object for the video
 * @param {object} metadata - Metadata to update
 * @returns {Promise<object>} - Object with video and preview paths
 */
/**
 * Downloads a file from a URL to a local destination path
 * @param {string} url - URL to download
 * @param {string} destPath - Local destination path
 * @returns {Promise<boolean>} - Whether the download was successful
 */
const downloadFile = (url, destPath) => {
  return new Promise((resolve, reject) => {
    console.log(`Downloading file from ${url} to ${destPath}`);
    
    // Validate URL
    if (!url || typeof url !== 'string' || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      console.error(`Invalid URL format: ${url}`);
      return reject(new Error(`Invalid URL format: ${url}`));
    }
    
    // Make sure destination directory exists
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
      console.log(`Created destination directory: ${destDir}`);
    }
    
    const file = fs.createWriteStream(destPath);
    
    // Parse URL to handle it properly
    try {
      // Create a proper URL object
      const parsedUrl = new URL(url);
      
      // Choose the right protocol
      let protocol;
      if (parsedUrl.protocol === 'https:') {
        protocol = require('https');
      } else if (parsedUrl.protocol === 'http:') {
        protocol = require('http');
      } else {
        throw new Error(`Unsupported protocol: ${parsedUrl.protocol}`);
      }
      
      console.log(`Using ${parsedUrl.protocol} protocol to download from ${parsedUrl.hostname}`);
      console.log(`Full path: ${parsedUrl.pathname}${parsedUrl.search || ''}`);
    
      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + (parsedUrl.search || ''),
        method: 'GET',
        headers: {
          'User-Agent': 'Media-Management-System/1.0'
        }
      };
      
      const request = protocol.request(options, response => {
        if (response.statusCode !== 200) {
          console.error(`Failed to download file: HTTP status code ${response.statusCode}`);
          file.close();
          fs.unlink(destPath, () => {}); // Clean up
          resolve(false);
          return;
        }
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          console.log(`Download complete, file saved to ${destPath}`);
          resolve(true);
        });
        
        file.on('error', err => {
          fs.unlink(destPath, () => {});
          console.error(`Error saving file: ${err.message}`);
          resolve(false);
        });
      });
      
      request.on('error', err => {
        fs.unlink(destPath, () => {});
        console.error(`Error downloading file: ${err.message}`);
        resolve(false);
      });
      
      // Actually send the request
      request.end();
    } catch (error) {
      console.error(`Error setting up download: ${error.message}`);
      resolve(false);
    }
  });
};

const processVideoAndGeneratePreview = async (file, metadata = {}) => {
  if (!file) return { videoPath: null, previewPath: null };
  
  console.log('Processing video and generating preview...');
  console.log('File data:', { 
    filename: file.filename,
    originalname: file.originalname,
    size: file.size,
    path: file.path
  });
  
  // Get the local file path
  const localFilePath = file.path || path.join(__dirname, 'uploads', file.filename);
  let videoPath = `/uploads/${file.filename}`;
  let previewPath = null;
  
  // Verify the file exists
  if (!fs.existsSync(localFilePath)) {
    console.error(`Error: Video file does not exist at path: ${localFilePath}`);
    return { videoPath, previewPath };
  }
  
  console.log(`Verified video file exists at: ${localFilePath}, size: ${fs.statSync(localFilePath).size} bytes`);
  
  // Make sure we have a metadata object
  if (!metadata.fileMetadata) metadata.fileMetadata = {};
  
  // Store original filename
  metadata.fileMetadata.movieOriginalFileName = file.originalname;
  
  // Step 1: Generate preview from local file
  try {
    const originalFilename = file.originalname;
    console.log(`Generating preview for local video: ${localFilePath}`);
    
    // This will generate preview and upload it to S3 if configured
    const previewUrl = await generateAndUploadPreview(localFilePath, originalFilename, true);
    console.log(`Preview generated successfully: ${previewUrl}`);
    
    // Try to get actual video dimensions using ffprobe
    let width = VIDEO_DIMENSIONS.WIDTH;
    let height = VIDEO_DIMENSIONS.HEIGHT;
    
    try {
      const videoUtils = require('./utils/videoUtils');
      const videoMetadata = await videoUtils.getVideoMetadata(localFilePath);
      
      if (videoMetadata && videoMetadata.width && videoMetadata.height) {
        width = videoMetadata.width;
        height = videoMetadata.height;
        console.log(`Using actual video dimensions: ${width}×${height}`);
      } else {
        console.log(`Using default video dimensions: ${width}×${height}`);
      }
    } catch (metadataError) {
      console.error('Error getting video metadata, using default dimensions:', metadataError);
    }
    
    // Set preview path and metadata
    previewPath = previewUrl;
    metadata.fileMetadata.previewOriginalFileName = "Auto-generated from video frame";
    metadata.fileMetadata.isPreviewGenerated = true;
    metadata.fileMetadata.width = width; 
    metadata.fileMetadata.height = height;
    metadata.fileMetadata.fileSize = file.size;
  } catch (previewError) {
    console.error('Error generating preview:', previewError);
    console.log('Continuing without preview');
  }
  
  // Step 2: Upload video to S3 if configured (after preview generation)
  if (isS3Configured) {
    try {
      console.log('Now uploading the actual video file to S3...');
      const videoS3Url = await uploadLocalFileToS3(localFilePath);
      
      if (videoS3Url) {
        console.log(`Video uploaded to S3: ${videoS3Url}`);
        videoPath = videoS3Url;
        
        // Clean up the local file after successful S3 upload
        try {
          if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
            console.log(`Deleted local file ${localFilePath} after S3 upload`);
          }
        } catch (cleanupError) {
          console.error(`Error cleaning up local file ${localFilePath}:`, cleanupError);
          // Continue even if cleanup fails - file will be stored in S3
        }
      } else {
        console.error('Failed to upload video to S3, keeping local path');
      }
    } catch (uploadError) {
      console.error('Error uploading video to S3:', uploadError);
      console.log('Keeping local video path');
    }
  }
  
  return { videoPath, previewPath };
};

// Promisify crypto.scrypt and crypto.randomBytes
const scrypt = util.promisify(crypto.scrypt);
const randomBytes = util.promisify(crypto.randomBytes);

// Password hashing and verification helper functions
async function hashPassword(password) {
  // Generate a random salt
  const salt = (await randomBytes(16)).toString('hex');
  // Use scrypt to hash the password with the salt
  const derivedKey = await scrypt(password, salt, 64);
  // Return the salt and the hashed password
  return `${salt}:${derivedKey.toString('hex')}`;
}

// Helper function to extract filename from S3 URL
function getFileNameFromS3Url(url) {
  try {
    // Remove query parameters if any
    const urlWithoutQuery = url.split('?')[0];
    
    // Extract the last part of the path
    const parts = urlWithoutQuery.split('/');
    const fileName = parts[parts.length - 1];
    
    // Remove the extension
    return path.basename(fileName, path.extname(fileName));
  } catch (error) {
    console.error('Error extracting filename from S3 URL:', error);
    return 'video-preview';
  }
}

async function verifyPassword(storedPassword, suppliedPassword) {
  try {
    // Check for undefined or invalid values
    if (!storedPassword) {
      console.error('Error verifying password: storedPassword is undefined or null');
      return false;
    }

    if (!suppliedPassword) {
      console.error('Error verifying password: suppliedPassword is undefined or null');
      return false;
    }

    // Check if the password is in the expected format
    if (!isAlreadyHashed(storedPassword)) {
      console.error('Error verifying password: stored password is not in the expected hashed format');
      return false;
    }

    // Split the stored password into salt and hash
    const [salt, storedHash] = storedPassword.split(':');

    // Double-check that we got both parts
    if (!salt || !storedHash) {
      console.error('Error verifying password: could not extract salt and hash from stored password');
      return false;
    }

    // Hash the supplied password with the same salt
    const derivedKey = await scrypt(suppliedPassword, salt, 64);

    // Compare the hashes
    return crypto.timingSafeEqual(
      Buffer.from(storedHash, 'hex'),
      derivedKey
    );
  } catch (error) {
    console.error('Error verifying password:', error);
    return false;
  }
}

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:3000', 'http://localhost:3002'];

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Get the configured storage engine from s3Storage utility
const storage = getStorage();

// File filter to allow all common media file types
const fileFilter = (req, file, cb) => {
  // Check if the file MIME type is allowed
  const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
  const allowedDocumentTypes = ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.apple.pages', 'application/vnd.google-apps.document'];
  const allowedVideoTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];

  // Allow any of these file types
  const allowedTypes = [...allowedImageTypes, ...allowedDocumentTypes, ...allowedVideoTypes];

  // Some browsers don't properly set mime types, so check file extension as fallback
  const extension = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.pdf', '.txt', '.doc', '.docx', '.mp4', '.mov', '.avi', '.webm', '.srt', '.pages', '.gdoc'];

  // Accept either by MIME type or extension
  if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(extension)) {
    cb(null, true);
  } else {
    console.log(`Rejected file: ${file.originalname} (${file.mimetype})`);
    cb(null, false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB limit
  }
});

// Sample data for initial seeding (if database is empty)
const sampleCards = [
  {
    type: 'image',
    preview: '/uploads/sample-image-preview.jpg',
    download: '/uploads/sample-image-download.jpg',
    tags: ['nature', 'landscape'],
    description: 'Beautiful mountain landscape at sunset',
  },
  {
    type: 'social',
    preview: '/uploads/sample-social-preview.jpg',
    transcript: '/uploads/sample-reel-transcript.txt', // Reusing the sample transcript file
    tags: ['marketing', 'social media'],
    description: 'Social media post template for summer campaign',
  },
  {
    type: 'reel',
    preview: '/uploads/sample-reel-preview.jpg',
    movie: '/uploads/sample-reel-video.mp4',
    transcript: '/uploads/sample-reel-transcript.txt',
    tags: ['video', 'testimonial'],
    description: 'Customer testimonial about our services',
  },
  {
    type: 'image',
    preview: '/uploads/sample-image-preview.jpg',
    download: '/uploads/sample-image-download.jpg',
    tags: ['product', 'photography'],
    description: 'Product photography for the new collection',
  },
  {
    type: 'image',
    download: '/uploads/1746863291660-ZIVE-logo_Sky.png',
    tags: ['logo', 'branding'],
    description: 'ZIVE Sky Logo',
  },
  {
    type: 'image',
    download: '/uploads/1746863024641-ZIVE-logo_Blue.png',
    tags: ['logo', 'branding'],
    description: 'ZIVE Blue Logo',
  }
];

// We'll store the admin user details but hash the password during seeding
const adminUser = {
  username: 'admin',
  password: 'HealthyGuts4Me!',
  email: 'owner@shopzive.com',
  role: 'admin',
};

// Sample tags to ensure we have a good starter set
const sampleTags = [
  { name: 'nature', count: 1 },
  { name: 'landscape', count: 1 },
  { name: 'marketing', count: 1 },
  { name: 'social media', count: 1 },
  { name: 'video', count: 1 },
  { name: 'testimonial', count: 1 },
  { name: 'product', count: 1 },
  { name: 'photography', count: 1 },
  { name: 'logo', count: 2 },
  { name: 'branding', count: 2 },
  { name: 'corporate', count: 0 },
  { name: 'event', count: 0 },
  { name: 'design', count: 0 },
  { name: 'creative', count: 0 }
];

// Helper function to check if a password is already hashed
function isAlreadyHashed(password) {
  // Our hashed passwords have a specific format: salt:hash
  return typeof password === 'string' && password.includes(':') && password.length > 64;
}

// Initialize database with sample data if empty
async function seedDatabase() {
  try {
    // Check if we have any cards
    const cardCount = await Card.countDocuments();
    if (cardCount === 0) {
      console.log('Seeding database with sample cards...');
      await Card.insertMany(sampleCards);
    }

    // Check if we have any users
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('Seeding database with sample users...');

      // Hash the admin password before saving with our scrypt helper
      const hashedPassword = await hashPassword(adminUser.password);

      // Create admin user with hashed password
      await User.create({
        username: adminUser.username,
        email: adminUser.email,
        password: hashedPassword,
        role: adminUser.role
      });

      console.log('Admin user created with hashed password');
    } else {
      // Update existing users to use hashed passwords if they are not already hashed
      console.log('Checking for users that need password hashing...');
      const users = await User.find({});

      for (const user of users) {
        // If the password isn't hashed yet, hash it
        if (!isAlreadyHashed(user.password)) {
          console.log(`Updating password hash for user: ${user.username}`);

          // If email is missing, add it (for backwards compatibility)
          if (!user.email) {
            user.email = user.username === 'admin' ? 'owner@shopzive.com' : `${user.username}@example.com`;
          }

          // Hash the plain text password
          user.password = await hashPassword(user.password);
          await user.save();
        }
      }
    }

    // Check if we have any tags
    const tagCount = await Tag.countDocuments();
    if (tagCount === 0) {
      console.log('Seeding database with sample tags...');
      await Tag.insertMany(sampleTags);
    }
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}

// Authentication middleware
const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Helper functions
const getBaseUrl = (req) => {
  return `${req.protocol}://${req.get('host')}`;
};

// Function to guess dimensions from filename or common types
function guessDimensionsFromUrl(url) {
  const filename = url.split('/').pop().toLowerCase();
  
  // Try to extract dimensions from filename patterns like 800x600, 1920x1080, etc.
  const dimensionsMatch = filename.match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (dimensionsMatch) {
    return {
      width: parseInt(dimensionsMatch[1], 10),
      height: parseInt(dimensionsMatch[2], 10)
    };
  }
  
  // Assign default dimensions based on file patterns
  if (filename.includes('logo')) {
    return { width: 800, height: 600 };
  } else if (filename.includes('icon')) {
    return { width: 512, height: 512 };
  } else if (filename.includes('banner') || filename.includes('header')) {
    return { width: 1200, height: 300 };
  } else if (filename.includes('profile') || filename.includes('avatar')) {
    return { width: 400, height: 400 };
  } else if (filename.endsWith('.png') || filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
    // Default dimensions for standard images
    return { width: 1920, height: 1080 };
  }
  
  // Couldn't determine dimensions
  return { width: null, height: null };
}

// Check if URL is an S3 URL
function isS3Url(url) {
  return url && (
    url.includes('amazonaws.com') || 
    url.includes('zivepublic.s3') || 
    url.startsWith('https://s3.')
  );
}

// Using VIDEO_DIMENSIONS from earlier import

// Utility function to extract metadata from uploaded files
const extractFileMetadata = async (filePath, providedDate = null) => {
  try {
    // Check if the path is a direct file path (used during the upload process)
    // In this case, we can extract dimensions directly from the file
    if (fs.existsSync(filePath)) {
      console.log(`Extracting metadata from direct file path: ${filePath}`);
      const stats = fs.statSync(filePath);
      const fileSize = stats.size; // File size in bytes
      const date = providedDate || new Date();
      let width = null;
      let height = null;

      // Get image dimensions for image files
      const extension = path.extname(filePath).toLowerCase();
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
      const videoExtensions = ['.mp4', '.mov', '.avi', '.webm'];

      if (imageExtensions.includes(extension)) {
        try {
          // Use image-size to get dimensions directly from the file
          const dimensions = sizeOf(filePath);
          width = dimensions.width;
          height = dimensions.height;
          console.log(`Successfully extracted dimensions from file: ${width}×${height}`);
        } catch (err) {
          console.error('Error getting image dimensions from direct file:', err);
          // Fall back to guessing dimensions
          const guessedDimensions = guessDimensionsFromUrl(filePath);
          width = guessedDimensions.width;
          height = guessedDimensions.height;
        }
      } else if (videoExtensions.includes(extension)) {
        try {
          // Try to extract actual dimensions from the video file using ffprobe
          const videoUtils = require('./utils/videoUtils');
          const metadata = await videoUtils.getVideoMetadata(filePath);
          
          if (metadata && metadata.width && metadata.height) {
            width = metadata.width;
            height = metadata.height;
            console.log(`Extracted actual video dimensions: ${width}×${height}`);
          } else {
            // Fall back to constants if metadata extraction fails
            width = VIDEO_DIMENSIONS.WIDTH;    // 720 for portrait orientation
            height = VIDEO_DIMENSIONS.HEIGHT;  // 1280 for portrait orientation
            console.log(`Using video dimensions from constants: ${width}×${height}`);
          }
        } catch (videoError) {
          console.error('Error extracting video metadata, using constants:', videoError);
          width = VIDEO_DIMENSIONS.WIDTH;    // 720 for portrait orientation
          height = VIDEO_DIMENSIONS.HEIGHT;  // 1280 for portrait orientation
        }
      }

      return {
        date,
        width,
        height,
        fileSize
      };
    }
    
    // Handle S3 URLs
    if (isS3Url(filePath)) {
      console.log(`Processing S3 file for metadata: ${filePath}`);
      
      // Try to guess dimensions from the URL/filename
      const guessedDimensions = guessDimensionsFromUrl(filePath);
      console.log(`Guessed dimensions from URL: ${guessedDimensions.width}×${guessedDimensions.height}`);
      
      // For videos, use constants instead of guessing
      const extension = path.extname(filePath).toLowerCase();
      const videoExtensions = ['.mp4', '.mov', '.avi', '.webm'];
      
      if (videoExtensions.includes(extension)) {
        guessedDimensions.width = VIDEO_DIMENSIONS.WIDTH;    // 720 for portrait
        guessedDimensions.height = VIDEO_DIMENSIONS.HEIGHT;  // 1280 for portrait
        console.log(`Using standard video dimensions for S3 video: ${guessedDimensions.width}×${guessedDimensions.height}`);
      }
      
      // For S3 files, set a default size since we can't determine it without downloading
      const defaultFileSize = 1024 * 1024; // 1MB as a reasonable default
      
      return {
        date: providedDate || new Date(),
        width: guessedDimensions.width,
        height: guessedDimensions.height,
        fileSize: defaultFileSize
      };
    }
    
    // Handle relative paths (paths that need to be joined with __dirname)
    const fullPath = path.join(__dirname, filePath);
    
    try {
      const stats = fs.statSync(fullPath);
      const fileSize = stats.size; // File size in bytes
      const date = providedDate || new Date();
      let width = null;
      let height = null;

      // Get image dimensions for image files
      const extension = path.extname(filePath).toLowerCase();
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
      const videoExtensions = ['.mp4', '.mov', '.avi', '.webm'];

      if (imageExtensions.includes(extension)) {
        try {
          // Use image-size to get dimensions
          const dimensions = sizeOf(fullPath);
          width = dimensions.width;
          height = dimensions.height;
          console.log(`Successfully extracted dimensions from relative path: ${width}×${height}`);
        } catch (err) {
          console.error('Error getting image dimensions:', err);
          
          // Fall back to guessing dimensions
          const guessedDimensions = guessDimensionsFromUrl(filePath);
          width = guessedDimensions.width;
          height = guessedDimensions.height;
        }
      } else if (videoExtensions.includes(extension)) {
        try {
          // Try to extract actual dimensions from the video file using ffprobe
          const videoUtils = require('./utils/videoUtils');
          const metadata = await videoUtils.getVideoMetadata(fullPath);
          
          if (metadata && metadata.width && metadata.height) {
            width = metadata.width;
            height = metadata.height;
            console.log(`Extracted actual video dimensions: ${width}×${height}`);
          } else {
            // Fall back to constants if metadata extraction fails
            width = VIDEO_DIMENSIONS.WIDTH;    // 720 for portrait orientation
            height = VIDEO_DIMENSIONS.HEIGHT;  // 1280 for portrait orientation
            console.log(`Using video dimensions from constants: ${width}×${height}`);
          }
        } catch (videoError) {
          console.error('Error extracting video metadata, using constants:', videoError);
          width = VIDEO_DIMENSIONS.WIDTH;    // 720 for portrait orientation
          height = VIDEO_DIMENSIONS.HEIGHT;  // 1280 for portrait orientation
        }
      }

      return {
        date,
        width,
        height,
        fileSize
      };
    } catch (fsError) {
      console.error('File not accessible:', fsError);
      
      // If file not accessible, try to guess dimensions from filename
      const guessedDimensions = guessDimensionsFromUrl(filePath);
      
      // For videos, use constants instead of guessing
      const extension = path.extname(filePath).toLowerCase();
      const videoExtensions = ['.mp4', '.mov', '.avi', '.webm'];
      
      if (videoExtensions.includes(extension)) {
        guessedDimensions.width = VIDEO_DIMENSIONS.WIDTH;    // 720 for portrait
        guessedDimensions.height = VIDEO_DIMENSIONS.HEIGHT;  // 1280 for portrait
        console.log(`Using standard video dimensions for inaccessible video: ${guessedDimensions.width}×${guessedDimensions.height}`);
      }
      
      return {
        date: providedDate || new Date(),
        width: guessedDimensions.width,
        height: guessedDimensions.height,
        fileSize: null
      };
    }
  } catch (error) {
    console.error('Error extracting file metadata:', error);
    return {
      date: providedDate || new Date(),
      width: 1920, // Default width for images
      height: 1080, // Default height for images
      fileSize: null
    };
  }
};

const getAllTags = async () => {
  try {
    // Get all tags from the dedicated Tag collection
    const tags = await Tag.find({}).sort({ name: 1 });
    const tagNames = tags.map(tag => tag.name);
    return tagNames;
  } catch (error) {
    console.error('Error getting all tags:', error);
    return [];
  }
};

// Function to process tags when creating or updating cards
const processTags = async (tagsList) => {
  if (!tagsList || !Array.isArray(tagsList) || tagsList.length === 0) {
    return;
  }


  try {
    // Process each tag in the list
    for (const tagName of tagsList) {
      const trimmedTag = tagName.trim();
      if (!trimmedTag) {
        continue;
      }

      // Try to find the tag
      const existingTag = await Tag.findOne({ name: trimmedTag });

      if (existingTag) {
        // Increment the tag usage count
        await Tag.updateOne(
          { _id: existingTag._id },
          { $inc: { count: 1 } }
        );
      } else {
        // Create a new tag
        await Tag.create({
          name: trimmedTag,
          count: 1
        });
      }
    }
  } catch (error) {
    console.error('Error processing tags:', error);
  }
};

// Function to update tag counts when deleting cards or removing tags
const updateTagCounts = async (tagsList) => {
  if (!tagsList || !Array.isArray(tagsList) || tagsList.length === 0) {
    return;
  }

  try {
    // Decrease count for each tag and remove if count reaches 0
    for (const tagName of tagsList) {
      const trimmedTag = tagName.trim();
      if (!trimmedTag) continue;

      // Update tag count
      const tag = await Tag.findOne({ name: trimmedTag });
      if (tag) {
        if (tag.count <= 1) {
          // If this is the last usage, remove the tag
          await Tag.deleteOne({ _id: tag._id });
        } else {
          // Otherwise decrement the count
          await Tag.updateOne(
            { _id: tag._id },
            { $inc: { count: -1 } }
          );
        }
      }
    }
  } catch (error) {
    console.error('Error updating tag counts:', error);
  }
};

// Auth routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify the password using our scrypt helper
    const isPasswordValid = await verifyPassword(user.password, password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Card routes
app.get('/api/cards', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const search = req.query.search || '';
    const types = req.query.type ? (Array.isArray(req.query.type) ? req.query.type : [req.query.type]) : [];
    const tags = req.query.tag ? (Array.isArray(req.query.tag) ? req.query.tag : [req.query.tag]) : [];

    // Build the filter query
    const filter = {};
    
    if (search) {
      // Search in both description and tags
      filter.$or = [
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (types.length > 0) {
      filter.type = { $in: types };
    }
    
    if (tags.length > 0) {
      filter.tags = { $in: tags };
    }

    // Get total count
    const totalCount = await Card.countDocuments(filter);
    
    // Pagination
    const skip = (page - 1) * limit;
    
    // Get paginated cards
    const cards = await Card.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Convert storage-specific file paths to public URLs
    const cardsWithAbsoluteUrls = cards.map(card => {
      const result = card.toObject();

      // Ensure imageSequence property exists for all card types (empty array for non-social)
      if (!result.imageSequence) {
        result.imageSequence = [];
      }

      // Process URLs based on card type
      if (card.type === 'image') {
        if (card.preview) {
          result.preview = getFileUrl(card.preview);
        }
        result.download = getFileUrl(card.download);
      } else if (card.type === 'social') {
        if (card.preview) {
          result.preview = getFileUrl(card.preview);
        }
        // Process imageSequence for social cards
        if (card.imageSequence && Array.isArray(card.imageSequence)) {
          result.imageSequence = card.imageSequence.map(url => getFileUrl(url));
        }
        result.documentCopy = getFileUrl(card.documentCopy);
      } else if (card.type === 'reel') {
        if (card.preview) {
          result.preview = getFileUrl(card.preview);
        }
        result.movie = getFileUrl(card.movie);
        result.transcript = getFileUrl(card.transcript);
      }

      return result;
    });

    // Get all available tags
    const availableTags = await getAllTags();

    res.json({
      cards: cardsWithAbsoluteUrls,
      totalCount,
      availableTags,
    });
  } catch (error) {
    console.error('Error getting cards:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/cards/:id', async (req, res) => {
  try {
    const card = await Card.findById(req.params.id);
    
    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    // Convert storage-specific file paths to public URLs
    const result = card.toObject();

    // Ensure imageSequence property exists for all card types (empty array for non-social)
    if (!result.imageSequence) {
      result.imageSequence = [];
    }

    // Process URLs based on card type
    if (card.type === 'image') {
      if (card.preview) {
        result.preview = getFileUrl(card.preview);
      }
      result.download = getFileUrl(card.download);
    } else if (card.type === 'social') {
      if (card.preview) {
        result.preview = getFileUrl(card.preview);
      }
      // Process imageSequence for social cards
      if (card.imageSequence && Array.isArray(card.imageSequence)) {
        result.imageSequence = card.imageSequence.map(url => getFileUrl(url));
      }
      result.documentCopy = getFileUrl(card.documentCopy);
    } else if (card.type === 'reel') {
      if (card.preview) {
        result.preview = getFileUrl(card.preview);
      }
      result.movie = getFileUrl(card.movie);
      result.transcript = getFileUrl(card.transcript);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error getting card:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a dynamic middleware to handle file uploads including sequence files
const handleCardUpload = (req, res, next) => {
  // We'll create a dynamic field configuration based on the request
  const fieldConfig = [
    { name: 'preview', maxCount: 1 },
    { name: 'download', maxCount: 1 },
    { name: 'movie', maxCount: 1 },
    { name: 'transcript', maxCount: 1 },
  ];
  
  // We can't reliably check headers for field names in advance
  // Instead, we'll add a fixed set of potential image sequence fields
  // This ensures Multer is prepared for any number of sequence images
  for (let i = 0; i < 50; i++) { // Support up to 50 images in a sequence
    fieldConfig.push({ name: `imageSequence_${i}`, maxCount: 1 });
  }
  
  // Also add the imageSequenceCount field explicitly
  fieldConfig.push({ name: 'imageSequenceCount', maxCount: 1 });
  
  // Add removal flags for all possible fields
  fieldConfig.push({ name: 'remove_preview', maxCount: 1 });
  fieldConfig.push({ name: 'remove_download', maxCount: 1 });
  fieldConfig.push({ name: 'remove_movie', maxCount: 1 });
  fieldConfig.push({ name: 'remove_transcript', maxCount: 1 });
  
  // Create a multer middleware with the dynamic field config
  const dynamicUpload = upload.fields(fieldConfig);
  
  // Execute the middleware
  dynamicUpload(req, res, next);
};

// Helper function to handle file upload validation
const validateFiles = (files, requiredFields) => {
  // Check if required files are present
  for (const field of requiredFields) {
    if (!files || !files[field] || files[field].length === 0) {
      console.log(`Missing required file field: ${field}`);
      return { valid: false, missingField: field };
    }
  }
  return { valid: true };
};

// Helper to extract and preserve the original filename
const preserveOriginalFileName = (req, file, field, updateObj) => {
  if (!updateObj.fileMetadata) {
    updateObj.fileMetadata = {};
  }

  // Store the original filename in the appropriate field
  const originalField = `${field}OriginalFileName`;
  updateObj.fileMetadata[originalField] = file.originalname;

  // Also store in the request for potential future use
  if (!req.fileOriginalNames) {
    req.fileOriginalNames = {};
  }
  req.fileOriginalNames[field] = file.originalname;
};

// Helper to validate card type based on fields
const validateCardType = (type, files) => {
  // Verify that the card type matches the provided files
  if (type === 'image' && (!files.download || files.download.length === 0)) {
    return { valid: false, message: 'Image cards require a download file' };
  } else if (type === 'social') {
    // Social cards only require image sequence which is handled separately
    return { valid: true };
  } else if (type === 'reel' && (!files.movie || files.movie.length === 0)) {
    return { valid: false, message: 'Reel cards require a movie file' };
  }

  return { valid: true };
};

// Debug utility to log received files
const logReceivedFiles = (files) => {
  console.log('Received files:');
  if (!files) {
    console.log('  No files received');
    return;
  }

  Object.keys(files).forEach(fieldName => {
    const file = files[fieldName][0];
    if (file) {
      console.log(`  ${fieldName}: ${file.originalname} (${file.mimetype}, ${Math.round(file.size/1024)}KB)`);
    }
  });
};

app.post('/api/cards', authMiddleware, handleCardUpload, async (req, res) => {
  try {
    // Log all received files for debugging
    logReceivedFiles(req.files);

    const { type, description, instagramCopy, facebookCopy } = req.body;
    const tags = req.body.tags ? req.body.tags.split(',').map(tag => tag.trim()) : [];

    // Extract date if provided in the form
    let date = req.body.date ? new Date(req.body.date) : new Date();

    if (!type || !description) {
      return res.status(400).json({ error: 'Type and description are required' });
    }

    // Check for special social card case when image sequence count is 0
    if (type === 'social') {
      const sequenceCount = parseInt(req.body.imageSequenceCount || '0', 10);
      if (sequenceCount <= 0) {
        console.log('Social card submission without image sequence detected');
        return res.status(400).json({ error: 'At least one image is required for social cards' });
      }
    }

    // Validate card type and files
    const typeValidation = validateCardType(type, req.files || {});
    if (!typeValidation.valid) {
      return res.status(400).json({ error: typeValidation.message });
    }

    // Process tags - add new tags or update existing ones
    await processTags(tags);

    const newCard = {
      type,
      tags,
      description,
      fileMetadata: {
        date: date,
        width: null,
        height: null,
        fileSize: null
      }
    };
    
    // Add social copy fields if provided for reel or social cards
    if ((type === 'reel' || type === 'social') && instagramCopy) {
      newCard.instagramCopy = instagramCopy;
    }
    
    if ((type === 'reel' || type === 'social') && facebookCopy) {
      newCard.facebookCopy = facebookCopy;
    }

    // Helper function to get file path from multer/multer-s3 file
    const getFilePath = (file) => {
      console.log(`getFilePath called with file:`, file ? {
        originalname: file.originalname,
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
        location: file.location,
        key: file.key,
        fieldname: file.fieldname,
        bucket: file.bucket,
        s3: !!file.s3
      } : 'null');

      // If using S3, the file location is stored differently
      if (isS3Configured && file) {
        // For multer-s3, the path is in file.location
        const path = file.location || file.key || (file.filename ? `/uploads/${file.filename}` : null);
        console.log(`getFilePath (S3): isS3Configured=${isS3Configured}, returning path: ${path}`);
        return path;
      }

      // For local storage
      const path = file ? `/uploads/${file.filename}` : null;
      console.log(`getFilePath (local): returning path: ${path}`);
      return path;
    };

    // Handle different card types
    if (type === 'image') {
      const validation = validateFiles(req.files, ['download']);
      if (!validation.valid) {
        return res.status(400).json({
          error: `Download image is required for image cards. Missing: ${validation.missingField}`
        });
      }

      if (req.files.preview && req.files.preview.length > 0) {
        const previewFile = req.files.preview[0];
        newCard.preview = await processFileAndGetPath(previewFile);

        // Store original filename in metadata
        preserveOriginalFileName(req, previewFile, 'preview', newCard);

        // Extract metadata for preview image if we can access the file
        if (!isS3Configured) {
          const previewMetadata = await extractFileMetadata(newCard.preview, date);
          // Only update dimensions and file size if they're not already set
          if (!newCard.fileMetadata.width && previewMetadata.width) {
            newCard.fileMetadata.width = previewMetadata.width;
          }
          if (!newCard.fileMetadata.height && previewMetadata.height) {
            newCard.fileMetadata.height = previewMetadata.height;
          }
          if (!newCard.fileMetadata.fileSize && previewMetadata.fileSize) {
            newCard.fileMetadata.fileSize = previewMetadata.fileSize;
          }
        } else {
          // For S3, we can use the file size from the file object
          if (previewFile.size) {
            newCard.fileMetadata.fileSize = previewFile.size;
          }
        }
      }

      const downloadFile = req.files.download[0];
      newCard.download = await processFileAndGetPath(downloadFile);

      // Store original filename in metadata
      preserveOriginalFileName(req, downloadFile, 'download', newCard);

      // Extract metadata if possible
      if (!isS3Configured) {
        const downloadMetadata = await extractFileMetadata(newCard.download, date);
        // Always use the downloadable image metadata over the preview
        newCard.fileMetadata.width = downloadMetadata.width || newCard.fileMetadata.width;
        newCard.fileMetadata.height = downloadMetadata.height || newCard.fileMetadata.height;
        newCard.fileMetadata.fileSize = downloadMetadata.fileSize || newCard.fileMetadata.fileSize;
      } else {
        // For S3, use the file size from the file object
        if (downloadFile.size) {
          newCard.fileMetadata.fileSize = downloadFile.size;
        }
      }
    } else if (type === 'social') {
      // Process image sequence - this is now the required field for social cards
      const sequenceCount = parseInt(req.body.imageSequenceCount || '0', 10);
      
      if (sequenceCount <= 0) {
        return res.status(400).json({
          error: `At least one image is required in the sequence for social cards`
        });
      }
      
      console.log(`Processing social card with ${sequenceCount} images in sequence`);
      
      // Process optional preview image if provided
      if (req.files.preview && req.files.preview.length > 0) {
        const previewFile = req.files.preview[0];
        newCard.preview = await processFileAndGetPath(previewFile);

        // Store original filename in metadata
        preserveOriginalFileName(req, previewFile, 'preview', newCard);

        // Extract metadata for preview image if we can access the file
        if (!isS3Configured) {
          const previewMetadata = await extractFileMetadata(newCard.preview, date);
          // Only update dimensions and file size if they're not already set
          if (!newCard.fileMetadata.width && previewMetadata.width) {
            newCard.fileMetadata.width = previewMetadata.width;
          }
          if (!newCard.fileMetadata.height && previewMetadata.height) {
            newCard.fileMetadata.height = previewMetadata.height;
          }
          if (!newCard.fileMetadata.fileSize && previewMetadata.fileSize) {
            newCard.fileMetadata.fileSize = previewMetadata.fileSize;
          }
        } else {
          // For S3, use the file size from the file object
          if (previewFile.size) {
            newCard.fileMetadata.fileSize = previewFile.size;
          }
        }
      }
      
      // Process all images in the sequence
      const sequenceResult = await processImageSequence(req, req.files, date, extractFileMetadata);
      
      // Add the image sequence to the card
      newCard.imageSequence = sequenceResult.imageSequence;
      
      // Add metadata for image sequence
      if (!newCard.fileMetadata) newCard.fileMetadata = {};
      newCard.fileMetadata.imageSequenceOriginalFileNames = sequenceResult.imageSequenceOriginalFileNames;
      newCard.fileMetadata.imageSequenceFileSizes = sequenceResult.imageSequenceFileSizes;
      newCard.fileMetadata.totalSequenceSize = sequenceResult.totalSequenceSize;
      newCard.fileMetadata.imageSequenceCount = sequenceResult.imageSequenceCount;
      
      // If no preview was provided, use the first image in the sequence
      if (!newCard.preview && newCard.imageSequence && newCard.imageSequence.length > 0) {
        newCard.preview = newCard.imageSequence[0];
        console.log(`Using first image in sequence as preview: ${newCard.preview}`);
      }
      
      // Process optional document copy if provided
      if (req.files.documentCopy && req.files.documentCopy.length > 0) {
        const documentFile = req.files.documentCopy[0];
        newCard.documentCopy = await processFileAndGetPath(documentFile);

        // Store original filename in metadata
        preserveOriginalFileName(req, documentFile, 'documentCopy', newCard);

        // Update document metadata
        if (!isS3Configured) {
          const documentMetadata = await extractFileMetadata(newCard.documentCopy, date);
          // We don't update the card's overall fileSize since we're now tracking totalSequenceSize
          newCard.fileMetadata.documentSize = documentMetadata.fileSize;
        } else {
          // For S3, use the file size from the file object
          if (documentFile.size) {
            newCard.fileMetadata.documentSize = documentFile.size;
          }
        }
      }
      
      // Process optional transcript if provided for social cards
      if (req.files.transcript && req.files.transcript.length > 0) {
        const transcriptFile = req.files.transcript[0];
        newCard.transcript = await processFileAndGetPath(transcriptFile);

        // Store original filename in metadata
        preserveOriginalFileName(req, transcriptFile, 'transcript', newCard);

        // Update transcript metadata
        if (!isS3Configured) {
          const transcriptMetadata = await extractFileMetadata(newCard.transcript, date);
          // Save transcript size in metadata
          newCard.fileMetadata.transcriptSize = transcriptMetadata.fileSize;
        } else {
          // For S3, use the file size from the file object
          if (transcriptFile.size) {
            newCard.fileMetadata.transcriptSize = transcriptFile.size;
          }
        }
      }
    } else if (type === 'reel') {
      const validation = validateFiles(req.files, ['movie']);
      if (!validation.valid) {
        return res.status(400).json({
          error: `Movie file is required for reel cards. Missing: ${validation.missingField}`
        });
      }

      const movieFile = req.files.movie[0];
      
      // Handle manual preview image upload if provided
      let hasManualPreview = false;
      if (req.files.preview && req.files.preview.length > 0) {
        console.log('Using manually uploaded preview image');
        const previewFile = req.files.preview[0];
        newCard.preview = await processFileAndGetPath(previewFile);
        hasManualPreview = true;

        // Store original filename in metadata
        preserveOriginalFileName(req, previewFile, 'preview', newCard);

        // Extract metadata for the preview image
        if (!isS3Configured) {
          const previewMetadata = await extractFileMetadata(newCard.preview, date);
          // Update dimensions and file size
          if (!newCard.fileMetadata.width && previewMetadata.width) {
            newCard.fileMetadata.width = previewMetadata.width;
          }
          if (!newCard.fileMetadata.height && previewMetadata.height) {
            newCard.fileMetadata.height = previewMetadata.height;
          }
          if (!newCard.fileMetadata.fileSize && previewMetadata.fileSize) {
            newCard.fileMetadata.fileSize = previewMetadata.fileSize;
          }
        } else {
          // For S3, use the file size from the file object
          if (previewFile.size) {
            newCard.fileMetadata.fileSize = previewFile.size;
          }
        }
      }
      
      // Process the video and generate preview if no manual preview was provided
      if (!hasManualPreview) {
        console.log('No manual preview provided, will auto-generate one from video');
        
        // Use our helper function to process video and generate preview in one go
        const { videoPath, previewPath } = await processVideoAndGeneratePreview(movieFile, newCard);
        
        if (videoPath) {
          console.log(`Setting video path to: ${videoPath}`);
          newCard.movie = videoPath;
        } else {
          // Fallback to local path if processing failed
          console.log(`Video processing failed, using local path: /uploads/${movieFile.filename}`);
          newCard.movie = `/uploads/${movieFile.filename}`;
          preserveOriginalFileName(req, movieFile, 'movie', newCard);
        }
        
        if (previewPath) {
          console.log(`Setting preview path to: ${previewPath}`);
          newCard.preview = previewPath;
        }
        
        // Add file size metadata if not already present
        if (!newCard.fileMetadata.fileSize && movieFile.size) {
          newCard.fileMetadata.fileSize = movieFile.size;
        }
      } else {
        // If we have a manual preview, just process the video file normally
        console.log('Using manual preview, processing video separately');
        
        // Keep the video local first
        newCard.movie = `/uploads/${movieFile.filename}`;
        preserveOriginalFileName(req, movieFile, 'movie', newCard);
        
        // Get detailed video metadata if possible
        try {
          const movieFullPath = path.join(__dirname, 'uploads', movieFile.filename);
          const videoMetadata = await getVideoMetadata(movieFullPath);
          
          // Add video metadata
          if (!newCard.fileMetadata) newCard.fileMetadata = {};
          newCard.fileMetadata.fileSize = videoMetadata.size || movieFile.size;
          newCard.fileMetadata.duration = videoMetadata.duration;
          newCard.fileMetadata.videoCodec = videoMetadata.codec;
          newCard.fileMetadata.fps = videoMetadata.fps;
          newCard.fileMetadata.bitrate = videoMetadata.bitrate;
          
          // Now upload to S3 if configured
          if (isS3Configured) {
            try {
              const s3Url = await uploadLocalFileToS3(movieFullPath);
              if (s3Url) {
                console.log(`Uploaded video to S3: ${s3Url}`);
                newCard.movie = s3Url;
                
                // Clean up the local file after successful S3 upload
                try {
                  if (fs.existsSync(movieFullPath)) {
                    fs.unlinkSync(movieFullPath);
                    console.log(`Deleted local file ${movieFullPath} after S3 upload`);
                  }
                } catch (cleanupError) {
                  console.error(`Error cleaning up local file ${movieFullPath}:`, cleanupError);
                  // Continue even if cleanup fails - file will be stored in S3
                }
              }
            } catch (s3Error) {
              console.error('Error uploading video to S3:', s3Error);
            }
          }
        } catch (error) {
          console.error('Error getting video metadata:', error);
          
          // Still try to upload to S3 if metadata extraction failed
          if (isS3Configured) {
            try {
              const movieFullPath = path.join(__dirname, 'uploads', movieFile.filename);
              const s3Url = await uploadLocalFileToS3(movieFullPath);
              if (s3Url) {
                console.log(`Uploaded video to S3: ${s3Url}`);
                newCard.movie = s3Url;
                
                // Clean up the local file after successful S3 upload
                try {
                  if (fs.existsSync(movieFullPath)) {
                    fs.unlinkSync(movieFullPath);
                    console.log(`Deleted local file ${movieFullPath} after S3 upload`);
                  }
                } catch (cleanupError) {
                  console.error(`Error cleaning up local file ${movieFullPath}:`, cleanupError);
                  // Continue even if cleanup fails - file will be stored in S3
                }
              }
            } catch (s3Error) {
              console.error('Error uploading video to S3:', s3Error);
            }
          }
        }
      }

      // Handle transcript file if provided (now optional)
      if (req.files.transcript && req.files.transcript.length > 0) {
        const transcriptFile = req.files.transcript[0];
        newCard.transcript = await processFileAndGetPath(transcriptFile);

        // Store original filename in metadata
        preserveOriginalFileName(req, transcriptFile, 'transcript', newCard);
      }
    } else {
      return res.status(400).json({ error: 'Invalid card type' });
    }

    // Save to database
    const card = new Card(newCard);
    await card.save();

    // Convert relative URLs to absolute URLs for response
    const baseUrl = getBaseUrl(req);
    const response = card.toObject();

    Object.keys(response).forEach(key => {
      if (key !== '_id' && key !== 'type' && key !== 'tags' && key !== 'description' &&
          key !== 'metadata' && key !== 'date' && key !== 'createdAt' && key !== 'updatedAt' && response[key]) {
        response[key] = baseUrl + response[key];
      }
    });

    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating card:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/cards/:id', authMiddleware, handleCardUpload, async (req, res) => {
  try {
    // Log all received files for debugging
    logReceivedFiles(req.files);
    console.log('Request body:', req.body);

    const cardId = req.params.id;
    const card = await Card.findById(cardId);

    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    const { type, description, instagramCopy, facebookCopy } = req.body;
    const tags = req.body.tags ? req.body.tags.split(',').map(tag => tag.trim()) : [];

    // Extract date if provided in the form, otherwise use existing or create new
    let date = req.body.date ? new Date(req.body.date) : (card.fileMetadata?.date || new Date());
    console.log('Update date value:', date);

    if (!type || !description) {
      return res.status(400).json({ error: 'Type and description are required' });
    }

    // Prevent changing card type after creation
    if (type !== card.type) {
      console.log(`Card type change attempted: ${card.type} -> ${type}`);
      return res.status(400).json({
        error: 'Card type cannot be changed after creation'
      });
    }
    
    // For reel cards, track if we need to auto-generate a preview
    const needsAutoPreview = (type === 'reel' && 
      (req.body.remove_preview === 'true' || !card.preview || req.body.generatePreview === 'true') && 
      (!req.files || !req.files.preview || req.files.preview.length === 0));
      
    // Track if a new movie file was uploaded
    const hasNewMovie = req.files && req.files.movie && req.files.movie.length > 0;
    
    // Track if we need to regenerate preview for existing video
    const shouldRegeneratePreview = req.body.generatePreview === 'true' && !hasNewMovie && card.movie;
    
    // For logging
    console.log('Update parameters:');
    console.log(`- Card type: ${type}`);
    console.log(`- Needs auto-preview: ${needsAutoPreview}`);
    console.log(`- Has new movie: ${hasNewMovie}`);
    console.log(`- Remove preview requested: ${req.body.remove_preview === 'true'}`);
    console.log(`- Has preview files: ${!!(req.files && req.files.preview && req.files.preview.length > 0)}`);
    console.log(`- S3 configured: ${isS3Configured}`);
    
    // In this updated workflow:
    // 1. Files are always processed locally first
    // 2. For videos, preview is generated from local file
    // 3. Only after processing, files are uploaded to S3 if configured

    // Handle tag changes
    // 1. Find removed tags to update their counts
    const removedTags = card.tags.filter(tag => !tags.includes(tag));
    if (removedTags.length > 0) {
      await updateTagCounts(removedTags);
    }

    // 2. Process new tags that didn't exist in the original card
    const newTags = tags.filter(tag => !card.tags.includes(tag));
    if (newTags.length > 0) {
      await processTags(newTags);
    }

    const updatedCard = {
      type,
      tags,
      description,
      fileMetadata: {
        ...(card.fileMetadata || {}), // Preserve existing metadata
        date: date // Update the date in fileMetadata
      }
    };
    
    // Handle social copy fields for reel and social cards
    if ((type === 'reel' || type === 'social')) {
      // If instagramCopy is explicitly provided, update it
      if (instagramCopy !== undefined) {
        updatedCard.instagramCopy = instagramCopy;
      }
      
      // If facebookCopy is explicitly provided, update it
      if (facebookCopy !== undefined) {
        updatedCard.facebookCopy = facebookCopy;
      }
    }

    // Helper function to get file path from multer/multer-s3 file
    const getFilePath = (file) => {
      console.log(`getFilePath called with file:`, file ? {
        originalname: file.originalname,
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
        location: file.location,
        key: file.key,
        fieldname: file.fieldname,
        bucket: file.bucket,
        s3: !!file.s3
      } : 'null');

      // If using S3, the file location is stored differently
      if (isS3Configured && file) {
        // For multer-s3, the path is in file.location
        const path = file.location || file.key || (file.filename ? `/uploads/${file.filename}` : null);
        console.log(`getFilePath (S3): isS3Configured=${isS3Configured}, returning path: ${path}`);
        return path;
      }

      // For local storage
      const path = file ? `/uploads/${file.filename}` : null;
      console.log(`getFilePath (local): returning path: ${path}`);
      return path;
    };

    // Handle file removal and update flags
    const handleFileField = async (field, currentValue) => {
      const removeFlag = req.body[`remove_${field}`] === 'true';

      if (removeFlag) {
        console.log(`Removing ${field} with flag: remove_${field}=${req.body[`remove_${field}`]}`);

        // Check if the file is orphaned and delete if it is
        if (currentValue) {
          try {
            const wasDeleted = await safeDeleteOrphanedFile(currentValue, Card);
            if (wasDeleted) {
              console.log(`Orphaned file ${currentValue} deleted successfully`);
            } else {
              console.log(`File ${currentValue} still in use by other cards, not deleted`);
            }
          } catch (err) {
            console.error(`Error safely deleting file ${currentValue}:`, err);
            // Continue even if file deletion fails
          }
        }

        // Also reset corresponding field in fileMetadata if it exists
        if (field === 'preview' && updatedCard.fileMetadata && updatedCard.fileMetadata.previewOriginalFileName) {
          if (!updatedCard.fileMetadata) updatedCard.fileMetadata = {};
          updatedCard.fileMetadata.previewOriginalFileName = null;
        }

        // MongoDB will only remove fields set to null or undefined in a $set operation
        // We need to use $unset explicitly to remove fields from documents
        return null; // Using null signals that we want to remove this field
      } else if (req.files && req.files[field] && req.files[field].length > 0) {
        const file = req.files[field][0];
        console.log(`Updating ${field} with new file: ${file.filename || file.key || 'S3 file'}`);
        const newPath = await processFileAndGetPath(file);

        // For existing files, we need to check if they'll be orphaned
        if (currentValue) {
          try {
            console.log(`Checking if file ${currentValue} will be orphaned after update`);
            
            // Create a copy of the current card with the updated field for orphan checking
            const tempCard = { ...card.toObject() };
            tempCard[field] = newPath;
            
            // Count how many other cards use this file
            const otherCardCount = await Card.countDocuments({
              _id: { $ne: card._id },
              $or: [
                { preview: currentValue },
                { download: currentValue },
                { documentCopy: currentValue },
                { movie: currentValue },
                { transcript: currentValue }
              ]
            });
            
            // If no other cards use this file, we can mark it for deletion
            if (otherCardCount === 0) {
              console.log(`File ${currentValue} will be orphaned - marking for deletion after update`);
              req.filesToDeleteAfterUpdate = req.filesToDeleteAfterUpdate || [];
              req.filesToDeleteAfterUpdate.push(currentValue);
            } else {
              console.log(`File ${currentValue} is used by ${otherCardCount} other cards - will not delete`);
            }
          } catch (err) {
            console.error(`Error checking file usage for ${currentValue}:`, err);
            // Continue even if the check fails
          }
        }

        // Preserve the original filename
        preserveOriginalFileName(req, file, field, updatedCard);

        // Extract metadata for the new file if we can access it directly
        if (!isS3Configured) {
          const metadata = await extractFileMetadata(newPath, date);
          if (!updatedCard.fileMetadata) {
            updatedCard.fileMetadata = {};
          }

          // Update width, height and fileSize but keep the date we set earlier
          if (metadata.width) updatedCard.fileMetadata.width = metadata.width;
          if (metadata.height) updatedCard.fileMetadata.height = metadata.height;
          if (metadata.fileSize) updatedCard.fileMetadata.fileSize = metadata.fileSize;
        } else {
          // For S3, use the file size from the file object
          if (!updatedCard.fileMetadata) {
            updatedCard.fileMetadata = {};
          }

          if (file.size) {
            updatedCard.fileMetadata.fileSize = file.size;
          }
        }

        return newPath;
      } else if (currentValue) {
        console.log(`Keeping existing ${field}: ${currentValue}`);
        // Keep existing metadata for this field
        return currentValue;
      }

      return undefined;
    };

    // Update files if new ones are uploaded
    if (type === 'image') {
      // Handle preview field (optional)
      updatedCard.preview = await handleFileField('preview', card.preview);

      // Handle download field (required for image cards)
      updatedCard.download = await handleFileField('download', card.download);

      // Ensure download field is present for image cards
      if (!updatedCard.download) {
        return res.status(400).json({
          error: 'Download image is required for image cards. Please upload a new file.'
        });
      }
    } else if (type === 'social') {
      // Handle preview field (optional)
      updatedCard.preview = await handleFileField('preview', card.preview);

      // Handle documentCopy field (now optional for social cards)
      updatedCard.documentCopy = await handleFileField('documentCopy', card.documentCopy);
      
      // Handle transcript field (optional for social cards)
      updatedCard.transcript = await handleFileField('transcript', card.transcript);
      
      // Process image sequence updates
      const sequenceCount = parseInt(req.body.imageSequenceCount || '0', 10);
      console.log(`Updating social card with ${sequenceCount} images in sequence`);
      
      // Process all images in the sequence (both new and existing)
      const date = updatedCard.fileMetadata?.date || new Date();
      const sequenceResult = await processImageSequence(req, req.files, date, extractFileMetadata, card);
      
      // Add the image sequence to the card
      updatedCard.imageSequence = sequenceResult.imageSequence;
      
      // Add metadata for image sequence
      if (!updatedCard.fileMetadata) updatedCard.fileMetadata = {};
      updatedCard.fileMetadata.imageSequenceOriginalFileNames = sequenceResult.imageSequenceOriginalFileNames;
      updatedCard.fileMetadata.imageSequenceFileSizes = sequenceResult.imageSequenceFileSizes;
      updatedCard.fileMetadata.totalSequenceSize = sequenceResult.totalSequenceSize;
      updatedCard.fileMetadata.imageSequenceCount = sequenceResult.imageSequenceCount;
      
      // If no preview was provided and sequence exists, use the first image in the sequence as preview
      if (!updatedCard.preview && updatedCard.imageSequence && updatedCard.imageSequence.length > 0) {
        updatedCard.preview = updatedCard.imageSequence[0];
        console.log(`Using first image in sequence as preview: ${updatedCard.preview}`);
      }
      
      if (updatedCard.imageSequence.length === 0 && (!card.imageSequence || card.imageSequence.length === 0)) {
        // If no image sequence provided in update and none existed before, return error 
        return res.status(400).json({
          error: 'At least one image in the sequence is required for social cards. Please upload at least one image.'
        });
      }
      // If no sequence is provided in the update but it exists in the card, keep existing sequence
    } else if (type === 'reel') {
      // Handle preview field (optional)
      console.log('Reel update - handling preview field');
      updatedCard.preview = await handleFileField('preview', card.preview);
      console.log('Reel update - preview result:', updatedCard.preview);

      // Handle movie field (required for reel cards)
      console.log('Reel update - handling movie field');
      
      // If a new movie was uploaded, process it using our optimized workflow
      if (hasNewMovie) {
        console.log('New movie file detected, processing with local-first approach');
        const movieFile = req.files.movie[0];
        
        // Process the video with our helper function to properly generate preview and handle S3 upload
        const { videoPath, previewPath } = await processVideoAndGeneratePreview(movieFile, updatedCard);
        
        if (videoPath) {
          console.log(`Using processed video path: ${videoPath}`);
          updatedCard.movie = videoPath;
        } else {
          // Fall back to standard method if our helper failed
          console.log('Video processing helper failed, falling back to standard method');
          updatedCard.movie = await handleFileField('movie', card.movie);
        }
        
        // If auto-preview was generated and we need it, use it
        if (previewPath && (needsAutoPreview || req.body.remove_preview === 'true')) {
          console.log(`Using auto-generated preview from new video: ${previewPath}`);
          updatedCard.preview = previewPath;
        }
      } else if (shouldRegeneratePreview) {
        // Regenerate preview for existing video
        console.log('Regenerating preview for existing video');
        
        // Get the movie URL from the card
        const movieUrl = card.movie;
        
        try {
          // Make sure we have the uploads directory path
          const uploadDir = path.join(__dirname, 'uploads');
          
          // Create directory if it doesn't exist
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          
          // Download the video file first
          const timestamp = Date.now();
          const tempVideoFilename = `${timestamp}-temp-video${path.extname(movieUrl) || '.mp4'}`;
          const tempVideoPath = path.join(uploadDir, tempVideoFilename);
          
          // Create a temporary file object to pass to the processor
          const tempFile = {
            filename: tempVideoFilename,
            originalname: card.fileMetadata?.movieOriginalFileName || path.basename(movieUrl),
            path: tempVideoPath,
            size: card.fileMetadata?.fileSize || 0
          };
          
          // Download the file
          console.log(`Attempting to download video from ${movieUrl} to ${tempVideoPath}`);
          const downloaded = await downloadFile(movieUrl, tempVideoPath);
          
          if (downloaded) {
            console.log('Successfully downloaded video file for preview generation');
            
            // Verify the file exists and has content
            try {
              const stats = fs.statSync(tempVideoPath);
              console.log(`Downloaded file size: ${stats.size} bytes`);
              
              if (stats.size === 0) {
                console.error("Downloaded file is empty");
                throw new Error("Downloaded file is empty");
              }
            } catch (statError) {
              console.error(`Error checking downloaded file: ${statError.message}`);
              throw statError;
            }
            
            // Now generate a preview from the downloaded file
            tempFile.path = tempVideoPath; // Ensure the path is correct
            console.log(`Using tempFile for preview generation:`, tempFile);
            const { previewPath } = await processVideoAndGeneratePreview(tempFile, updatedCard);
            
            if (previewPath) {
              console.log(`Using regenerated preview: ${previewPath}`);
              updatedCard.preview = previewPath;
              
              // Mark the preview as autogenerated
              if (!updatedCard.fileMetadata) updatedCard.fileMetadata = {};
              updatedCard.fileMetadata.isPreviewGenerated = true;
              updatedCard.fileMetadata.previewOriginalFileName = "Auto-generated from video frame";
            }
            
            // Clean up the temp file
            try {
              fs.unlinkSync(tempVideoPath);
              console.log('Temporary video file cleaned up');
            } catch (cleanupError) {
              console.error('Error cleaning up temp file:', cleanupError);
            }
          } else {
            console.error('Failed to download video file for preview generation');
          }
        } catch (previewError) {
          console.error('Error regenerating preview:', previewError);
        }
        
        // Keep existing movie file unchanged
        updatedCard.movie = card.movie;
      } else {
        // Use standard method for existing movie file
        updatedCard.movie = await handleFileField('movie', card.movie);
      }
      
      console.log('Reel update - movie result:', updatedCard.movie);

      // Handle transcript field (optional for reel cards)
      updatedCard.transcript = await handleFileField('transcript', card.transcript);

      // Ensure required fields are present for reel cards
      if (!updatedCard.movie) {
        return res.status(400).json({
          error: 'Movie file is required for reel cards. Please upload a new file.'
        });
      }
    }

    // Get a copy of the original card for checking orphaned files
    const originalCard = card.toObject();
    
    // Auto-generate preview image from video if needed
    // We use our renamed 'needsAutoPreview' variable here (was 'needsLocalAutoPreview')
    if (needsAutoPreview && card.movie) {
      try {
        console.log('Auto-generating preview image from video...');
        // Don't prepend paths to URLs
        const moviePath = card.movie.startsWith('http') ? card.movie : path.join(__dirname, card.movie);
        const uploadDir = path.join(__dirname, 'uploads');
        
        // Create a temporary local file if it's a URL
        let localVideoPath;
        let needsCleanup = false;
        
        if (card.movie.startsWith('http')) {
          // For URLs, we need to download to a temp file first
          const tempDir = path.join(__dirname, PREVIEW_SETTINGS.TEMP_DIR);
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }
          
          const tempFileName = `temp-video-${Date.now()}.mp4`;
          localVideoPath = path.join(tempDir, tempFileName);
          
          try {
            // Download the file
            console.log(`Downloading video from ${moviePath} to ${localVideoPath}`);
            await downloadFile(moviePath, localVideoPath);
            needsCleanup = true;
          } catch (dlError) {
            console.error('Error downloading video file:', dlError);
            throw new Error('Failed to download video file');
          }
        } else {
          // For local files, use the path directly
          localVideoPath = moviePath;
        }
        
        try {
          // Check if the local file exists and is a video
          if (!fs.existsSync(localVideoPath)) {
            throw new Error(`Video file does not exist: ${localVideoPath}`);
          }
          
          // Check if the file is actually a video
          const fileCheck = require('child_process').execSync(`file "${localVideoPath}"`).toString();
          console.log(`File check result: ${fileCheck}`);
          
          if (fileCheck.includes('HTML') || !fileCheck.includes('video')) {
            console.warn('Not a valid video file - using fallback colored preview');
            // Clean up temp file if needed before continuing
            if (needsCleanup && fs.existsSync(localVideoPath)) {
              try {
                fs.unlinkSync(localVideoPath);
                console.log(`Cleaned up invalid video file: ${localVideoPath}`);
              } catch (cleanupErr) {
                console.warn(`Failed to clean up temp file: ${cleanupErr.message}`);
              }
            }
            throw new Error('Invalid video file format');
          }
          
          // Extract a frame from the video
          const previewPath = await extractVideoFrame(localVideoPath, uploadDir);
          
          // Get relative path for storage
          const previewRelativePath = '/uploads/' + path.basename(previewPath);
          console.log(`Generated preview image at ${previewRelativePath}`);
          
          // Update the card with the new preview
          updatedCard.preview = previewRelativePath;
          
          // Store metadata indicating auto-generation
          if (!updatedCard.fileMetadata) updatedCard.fileMetadata = {};
          updatedCard.fileMetadata.previewOriginalFileName = `Auto-generated from ${path.basename(card.movie)}`;
          
          // Extract metadata for the preview image
          const previewMetadata = await extractFileMetadata(previewRelativePath, date);
          if (previewMetadata.width) updatedCard.fileMetadata.width = previewMetadata.width;
          if (previewMetadata.height) updatedCard.fileMetadata.height = previewMetadata.height;
        } catch (error) {
          console.error('Error extracting preview frame from video:', error);
          
          // Clean up temp file if it exists
          if (needsCleanup && fs.existsSync(localVideoPath)) {
            try {
              fs.unlinkSync(localVideoPath);
              console.log(`Cleaned up temp file after error: ${localVideoPath}`);
            } catch (cleanupErr) {
              console.warn(`Failed to clean up temp file: ${cleanupErr.message}`);
            }
          }
          
          // Create a fallback colored image using sharp
          console.log('Creating fallback colored preview image...');
          
          // Generate a video-like preview with a play button
          const width = 720;
          const height = 1280;
          const originalName = path.basename(card.movie, path.extname(card.movie));
          const previewFilename = `${originalName}-preview-fallback-${uuidv4().substring(0, 8)}.jpg`;
          const previewPath = path.join(uploadDir, previewFilename);
          
          // Create a simple colored background
          // Generate a random color
          const r = Math.floor(Math.random() * 200) + 25; // 25-225 for better visibility
          const g = Math.floor(Math.random() * 200) + 25;
          const b = Math.floor(Math.random() * 200) + 25;
          
          console.log(`Using random color: rgb(${r},${g},${b})`);
          
          await sharp({
            create: {
              width: width,
              height: height,
              channels: 4,
              background: { r, g, b, alpha: 1 }
            }
          })
          .composite([
            {
              input: Buffer.from(`
                <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
                  <rect width="100%" height="100%" fill="rgb(${r},${g},${b})" />
                  <text x="${width/2}" y="${height/2}" text-anchor="middle" font-family="Arial" font-size="32" fill="white">${path.basename(movieFullPath, path.extname(movieFullPath))}</text>
                </svg>
              `),
              top: 0,
              left: 0
            }
          ])
          .jpeg({ quality: 90 })
          .toFile(previewPath);
          
          console.log(`Created fallback preview image at ${previewPath}`);
          updatedCard.preview = '/uploads/' + previewFilename;
          
          // Add metadata
          if (!updatedCard.fileMetadata) updatedCard.fileMetadata = {};
          updatedCard.fileMetadata.previewOriginalFileName = `Auto-generated fallback for ${path.basename(card.movie)}`;
          updatedCard.fileMetadata.width = width;
          updatedCard.fileMetadata.height = height;
        }
      } catch (error) {
        console.error('All preview generation attempts failed:', error);
        // Continue without preview if generation fails
      }
    } else if (needsAutoPreview && isS3Configured && card.movie) {
      // Handle S3-stored videos
      try {
        console.log('Creating preview for S3-stored video during edit...');
        
        // Get movie URL
        const movieUrl = card.movie;
        console.log('Movie URL:', movieUrl);
        
        if (!movieUrl) {
          throw new Error('Cannot determine S3 location for the video file');
        }
        
        // Extract the original filename from the metadata
        const originalFilename = card.fileMetadata?.movieOriginalFileName || path.basename(movieUrl);
        
        // Generate and upload the preview
        const previewUrl = await generateAndUploadPreview(movieUrl, originalFilename);
        
        // Set the preview URL in the card data
        updatedCard.preview = previewUrl;
        
        // Update metadata
        if (!updatedCard.fileMetadata) updatedCard.fileMetadata = {};
        updatedCard.fileMetadata.previewOriginalFileName = `Auto-generated for ${originalFilename}`;
        updatedCard.fileMetadata.width = 720; // Default width from the generator
        updatedCard.fileMetadata.height = 1280; // Default height from the generator
        
        console.log('Successfully added preview URL to card:', previewUrl);
      } catch (error) {
        console.error('Error handling S3 video preview during edit:', error);
      }
    }

    // Generate a preview for a newly uploaded movie to S3 when no preview was provided
    console.log('================== S3 PREVIEW GENERATION CHECK ==================');
    console.log('S3 preview check - isS3Configured:', isS3Configured);
    console.log('S3 preview check - hasNewMovie:', hasNewMovie);
    console.log('S3 preview check - type:', type);
    console.log('S3 preview check - hasPreviewFiles:', !!(req.files && req.files.preview && req.files.preview.length > 0));
    console.log('S3 preview check - updatedCard.preview:', updatedCard.preview);
    console.log('S3 preview check - req.body.remove_preview:', req.body.remove_preview);
    console.log('S3 preview check - shouldRemovePreview param:', req.body.remove_preview === 'true');
    console.log('S3 preview check - updatedCard.movie:', updatedCard.movie);
    console.log('S3 preview check - movie file exists:', !!(req.files && req.files.movie && req.files.movie.length > 0));
    if (req.files && req.files.movie && req.files.movie.length > 0) {
      console.log('S3 preview check - movie file details:', {
        originalname: req.files.movie[0].originalname,
        mimetype: req.files.movie[0].mimetype,
        size: req.files.movie[0].size,
        location: req.files.movie[0].location,
        key: req.files.movie[0].key,
        bucket: req.files.movie[0].bucket
      });
    }
    
    // We no longer need to check for preview removal as it's handled in our 
    // optimized workflow with the processVideoAndGeneratePreview function
    
    console.log('================== FILE PROCESSING SUMMARY ==================');
    console.log('File processing complete with the following results:');
    console.log(`- Type: ${type}`);
    console.log(`- Uses S3: ${isS3Configured ? 'Yes' : 'No'}`);
    console.log(`- Changed movie file: ${hasNewMovie ? 'Yes' : 'No'}`);
    console.log(`- Provided preview file: ${!!(req.files && req.files.preview && req.files.preview.length > 0) ? 'Yes' : 'No'}`);
    console.log(`- Final movie path: ${updatedCard.movie || '(none)'}`);
    console.log(`- Final preview path: ${updatedCard.preview || '(none)'}`);
    console.log(`- Final transcript path: ${updatedCard.transcript || '(none)'}`);
    
    // Log movie file details for debugging
    if (req.files && req.files.movie && req.files.movie.length > 0) {
      console.log('S3 preview check - movie file exists:', true);
      console.log('S3 preview check - movie file details:', {
        originalname: req.files.movie[0].originalname,
        mimetype: req.files.movie[0].mimetype,
        size: req.files.movie[0].size,
        location: req.files.movie[0].location,
        key: req.files.movie[0].key,
        bucket: req.files.movie[0].bucket
      });
    } else if (updatedCard.movie) {
      console.log('S3 preview check - movie URL:', updatedCard.movie);
    } else {
      console.log('S3 preview check - movie file exists:', false);
    }
    
    // Define conditions for generating a preview
    const shouldRemovePreview = req.body.remove_preview === 'true';
    const generatePreviewFlag = req.body.generatePreview === 'true';
    // If we already regenerated the preview earlier, don't try again
    const previewAlreadyGenerated = updatedCard.preview && 
                                    updatedCard.fileMetadata && 
                                    updatedCard.fileMetadata.isPreviewGenerated === true;
    
    const shouldGeneratePreview = type === 'reel' && 
                                 (hasNewMovie || shouldRemovePreview || generatePreviewFlag) && 
                                 (!req.files || !req.files.preview || req.files.preview.length === 0);
                                 
    console.log('S3 preview generation conditions met:', shouldGeneratePreview);
    console.log('Conditions breakdown:');
    console.log('- isS3Configured:', isS3Configured);
    console.log('- type === \'reel\':', type === 'reel');
    console.log('- hasNewMovie:', hasNewMovie);
    console.log('- shouldRemovePreview:', shouldRemovePreview);
    console.log('- generatePreviewFlag:', generatePreviewFlag);
    console.log('- previewAlreadyGenerated:', previewAlreadyGenerated);
    console.log('- Current preview:', updatedCard.preview);
    console.log('- !hasPreviewFiles:', !req.files || !req.files.preview || req.files.preview.length === 0);
    // Preview generation is now handled in our optimized workflow
    
    // Generate preview if:
    // 1. It's a reel card with S3 configured, AND
    // 2. Either:
    //    a. It's a new video without a preview uploaded, OR
    //    b. User explicitly requested to remove/regenerate the preview
    // 3. No preview file was uploaded
    
    // If we need to generate a preview but haven't already done so, do it now
    if (shouldGeneratePreview && updatedCard.movie) {
      console.log('Conditions met for preview generation from existing movie:', updatedCard.movie);
      
      try {
        console.log('================== PREVIEW REGENERATION START ==================');
        console.log(`Source movie URL: ${updatedCard.movie}`);
        
        // Create a temp directory if needed
        const tempDir = path.join(__dirname, PREVIEW_SETTINGS.TEMP_DIR);
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
          console.log(`Created temp directory: ${tempDir}`);
        }
        
        // Create a unique filename for the temp file
        const uuid = require('uuid').v4();
        const tempVideoPath = path.join(tempDir, `temp-download-${uuid.substring(0, 8)}${path.extname(updatedCard.movie) || '.mp4'}`);
        
        // Download the movie to a temp file
        console.log(`Downloading movie from ${updatedCard.movie} to ${tempVideoPath}`);
        await downloadFile(updatedCard.movie, tempVideoPath);
        
        // Check if the download worked
        if (!fs.existsSync(tempVideoPath)) {
          throw new Error(`Failed to download movie file: File does not exist at ${tempVideoPath}`);
        }
        
        const fileSize = fs.statSync(tempVideoPath).size;
        if (fileSize === 0) {
          throw new Error(`Downloaded movie file is empty (0 bytes)`);
        }
        
        console.log(`Downloaded movie file successfully, size: ${fileSize} bytes`);
        
        // Create a temp file object that mimics multer's file object
        const tempFile = {
          filename: path.basename(tempVideoPath),
          originalname: updatedCard.fileMetadata?.movieOriginalFileName || path.basename(updatedCard.movie),
          path: tempVideoPath,
          size: fileSize
        };
        
        console.log('Temp file object created:', tempFile);
        
        // Generate the preview
        console.log('Calling processVideoAndGeneratePreview...');
        const { previewPath } = await processVideoAndGeneratePreview(tempFile, updatedCard);
        
        if (!previewPath) {
          throw new Error('Failed to generate preview - no preview path returned');
        }
        
        console.log(`Generated preview successfully: ${previewPath}`);
        updatedCard.preview = previewPath;
        
        // Mark the preview as autogenerated
        if (!updatedCard.fileMetadata) updatedCard.fileMetadata = {};
        updatedCard.fileMetadata.isPreviewGenerated = true;
        updatedCard.fileMetadata.previewOriginalFileName = "Auto-generated from video frame";
        console.log('Updated card metadata for autogenerated preview');
        
        // Clean up the temp file
        try {
          fs.unlinkSync(tempVideoPath);
          console.log('Temporary video file cleaned up');
        } catch (cleanupError) {
          console.error('Error cleaning up temp file:', cleanupError);
          // Continue even if cleanup fails
        }
        
        console.log('================== PREVIEW REGENERATION SUCCESS ==================');
      } catch (previewError) {
        console.error('================== PREVIEW REGENERATION ERROR ==================');
        console.error('Error generating preview from existing movie:', previewError);
        console.error('Error stack:', previewError.stack);
        console.error('================== END PREVIEW REGENERATION ERROR ==================');
        // Continue without failing the whole update
      }
    }
    
    // Rest of the workflow is handled by the processVideoAndGeneratePreview function:
    // 1. Process videos locally first
    // 2. Generate previews from local files
    // 3. Upload files to S3 only after processing
    console.log('================== END FILE PROCESSING ==================');
    
    // Log the update operation for debugging purposes
    console.log('Updating card with the following data:', JSON.stringify(updatedCard, null, 2));

    // Create an explicit $unset operation for any null fields
    const unsetFields = {};
    for (const [key, value] of Object.entries(updatedCard)) {
      if (value === null) {
        unsetFields[key] = "";
        delete updatedCard[key]; // Remove from the $set operation
      }
    }

    // Perform the update with both $set and $unset operations
    const updateOperation = { $set: updatedCard };
    if (Object.keys(unsetFields).length > 0) {
      updateOperation.$unset = unsetFields;
      console.log('Explicitly unsetting fields:', JSON.stringify(unsetFields, null, 2));
    }

    // Update the card in the database
    let updated;
    try {
      console.log(`Updating card ${cardId} in database with operation:`, JSON.stringify(updateOperation, null, 2));
      updated = await Card.findByIdAndUpdate(cardId, updateOperation, { 
        new: true,     // Return the updated document
        runValidators: true  // Run mongoose validators
      });
      
      if (!updated) {
        throw new Error(`Failed to update card ${cardId} - no document returned`);
      }
      
      console.log(`Card ${cardId} successfully updated`);
    } catch (updateError) {
      console.error('MongoDB update error:', updateError);
      return res.status(500).json({ 
        error: 'Failed to update card in database',
        details: updateError.message 
      });
    }

    // Process any files marked for deletion during the update
    if (req.filesToDeleteAfterUpdate && req.filesToDeleteAfterUpdate.length > 0) {
      console.log(`Cleaning up ${req.filesToDeleteAfterUpdate.length} orphaned files after update`);
      
      for (const fileToDelete of req.filesToDeleteAfterUpdate) {
        try {
          // Double-check that the file is truly orphaned before deleting
          const isOrphaned = await isFileOrphaned(fileToDelete, Card);
          
          if (isOrphaned) {
            console.log(`Confirmed file ${fileToDelete} is orphaned, deleting...`);
            await deleteFile(fileToDelete);
            console.log(`Successfully deleted orphaned file: ${fileToDelete}`);
          } else {
            console.log(`File ${fileToDelete} is no longer orphaned, not deleting`);
          }
        } catch (err) {
          console.error(`Error deleting orphaned file ${fileToDelete}:`, err);
        }
      }
    } else {
      console.log('No orphaned files to clean up after update');
    }
    
    // Final check for any files that might have been orphaned
    if (updated) { // Only proceed if we have a valid updated card
      const fieldsToCheck = ['preview', 'download', 'documentCopy', 'movie', 'transcript'];
      
      // Check regular fields
      for (const field of fieldsToCheck) {
        // Check if the field existed in the original card and was changed or removed
        if (originalCard[field] &&
           (updated[field] !== originalCard[field] || !updated[field])) {

          // Check if the old file is now orphaned
          try {
            const wasDeleted = await safeDeleteOrphanedFile(originalCard[field], Card);
            if (wasDeleted) {
              console.log(`Orphaned file ${originalCard[field]} deleted successfully in final check`);
            } else {
              console.log(`File ${originalCard[field]} still in use by other cards, not deleted`);
            }
          } catch (err) {
            console.error(`Error safely deleting file ${originalCard[field]}:`, err);
          }
        }
      }
      
      // Special handling for image sequence fields
      if (originalCard.type === 'social' && originalCard.imageSequence && Array.isArray(originalCard.imageSequence)) {
        const currentImageSequence = updated.imageSequence || [];
        
        // Find files that were in the original sequence but not in the updated sequence
        for (const imagePath of originalCard.imageSequence) {
          if (imagePath && !currentImageSequence.includes(imagePath)) {
            try {
              console.log(`Checking if removed sequence image ${imagePath} is now orphaned`);
              const wasDeleted = await safeDeleteOrphanedFile(imagePath, Card);
              if (wasDeleted) {
                console.log(`Orphaned sequence image ${imagePath} deleted successfully`);
              } else {
                console.log(`Sequence image ${imagePath} still in use by other cards, not deleted`);
              }
            } catch (err) {
              console.error(`Error safely deleting sequence image ${imagePath}:`, err);
            }
          }
        }
      }
    } else {
      console.log('Skipping orphaned file check - no updated card available');
    }

    // Convert relative URLs to absolute URLs for response
    if (!updated) {
      // This should not happen as we've already returned an error if the update failed,
      // but adding this as an additional safeguard
      return res.status(500).json({ error: 'Card update failed' });
    }
    
    const baseUrl = getBaseUrl(req);
    const response = updated.toObject();

    Object.keys(response).forEach(key => {
      if (key !== '_id' && key !== 'type' && key !== 'tags' && key !== 'description' &&
          key !== 'metadata' && key !== 'date' && key !== 'createdAt' && key !== 'updatedAt' && response[key]) {
        response[key] = baseUrl + response[key];
      }
    });

    res.json(response);
  } catch (error) {
    console.error('Error updating card:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/cards/:id', authMiddleware, async (req, res) => {
  try {
    const cardId = req.params.id;
    const card = await Card.findById(cardId);

    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    // Check if this is the last card of a type before deleting
    // This is no longer necessary as we're allowing deletion of the last card of a type
    /* 
    const cardsOfSameType = await Card.countDocuments({ 
      _id: { $ne: cardId }, 
      type: card.type 
    });
    
    if (cardsOfSameType === 0) {
      return res.status(400).json({ 
        error: `Cannot delete the last ${card.type} card. At least one card of each type must remain.` 
      });
    }
    */

    // Update tag counts before deleting the card
    if (card.tags && card.tags.length > 0) {
      await updateTagCounts(card.tags);
    }

    // Delete the card first to ensure files become orphaned
    await Card.findByIdAndDelete(cardId);
    console.log(`Card ${cardId} deleted from database`);

    // Collect all files to check and delete if orphaned
    const filesToCheck = [];

    // Add files based on card type
    if (card.preview) filesToCheck.push(card.preview);

    if (card.type === 'image' && card.download) {
      filesToCheck.push(card.download);
    } else if (card.type === 'social') {
      // Handle image sequence files
      if (card.imageSequence && Array.isArray(card.imageSequence)) {
        card.imageSequence.forEach(imagePath => {
          if (imagePath) filesToCheck.push(imagePath);
        });
      }
      // Handle optional transcript
      if (card.transcript) filesToCheck.push(card.transcript);
    } else if (card.type === 'reel') {
      if (card.movie) filesToCheck.push(card.movie);
      if (card.transcript) filesToCheck.push(card.transcript);
    }

    // Delete files if they are now orphaned
    for (const file of filesToCheck) {
      try {
        const wasDeleted = await safeDeleteOrphanedFile(file, Card);
        if (wasDeleted) {
          console.log(`Orphaned file ${file} deleted successfully`);
        } else {
          console.log(`File ${file} still in use by other cards, not deleted`);
        }
      } catch (err) {
        console.error(`Error checking/deleting file ${file}:`, err);
        // Continue even if file deletion fails
      }
    }

    res.status(204).end();
  } catch (error) {
    console.error('Error deleting card:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all available tags
app.get('/api/tags', async (req, res) => {
  try {
    const tags = await getAllTags();
    res.json(tags);
  } catch (error) {
    console.error('Error getting tags:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Route to download all card files as a ZIP
app.get('/api/cards/:id/download-package', async (req, res) => {
  try {
    const cardId = req.params.id;
    console.log(`Preparing download package for card ${cardId}`);
    
    // Get the card
    const card = await Card.findById(cardId);
    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }
    
    console.log(`Creating download package for ${card.type} card`);
    
    // Make sure we're working with a plain object, not a Mongoose document
    const cardData = card.toObject ? card.toObject() : JSON.parse(JSON.stringify(card));
    
    // Create the ZIP file with all card files
    const zipPath = await createCardZip(cardData);
    
    // Return a local server URL for the ZIP file instead of S3
    const baseUrl = getBaseUrl(req);
    const zipFilename = path.basename(zipPath);
    const localZipUrl = `${baseUrl}/api/download-zip/${zipFilename}`;
    res.json({ downloadUrl: localZipUrl });
  } catch (error) {
    console.error('Error creating download package:', error);
    res.status(500).json({ error: 'Failed to create download package' });
  }
});

// Route to serve ZIP files directly from local server
app.get('/api/download-zip/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const zipPath = path.join(__dirname, 'uploads', filename);
    
    // Security check: ensure filename doesn't contain path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    // Check if file exists
    if (!fs.existsSync(zipPath)) {
      return res.status(404).json({ error: 'ZIP file not found' });
    }
    
    // Set appropriate headers for ZIP download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Stream the file
    console.log(`Serving ZIP file: ${zipPath}`);
    const fileStream = fs.createReadStream(zipPath);
    fileStream.pipe(res);
    
    fileStream.on('error', (err) => {
      console.error('Error streaming ZIP file:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error downloading file' });
      }
    });
    
  } catch (error) {
    console.error('Error serving ZIP file:', error);
    res.status(500).json({ error: 'Failed to serve ZIP file' });
  }
});

// === USER MANAGEMENT ROUTES ===
// These routes allow admins to manage users

// Get all users (admin only)
app.get('/api/users', authMiddleware, async (req, res) => {
  try {
    // Check if the requesting user is an admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
    }

    // Fetch all users (excluding passwords)
    const users = await User.find({}, { password: 0 });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get a single user by ID (admin only)
app.get('/api/users/:id', authMiddleware, async (req, res) => {
  try {
    // Check if the requesting user is an admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
    }

    const user = await User.findById(req.params.id, { password: 0 });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a new user (admin only)
app.post('/api/users', authMiddleware, async (req, res) => {
  try {
    // Check if the requesting user is an admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
    }

    const { username, email, password, role } = req.body;

    // Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    // Check if username or email already exists
    const existingUser = await User.findOne({
      $or: [{ username }, { email }]
    });

    if (existingUser) {
      return res.status(400).json({
        error: 'Username or email already in use'
      });
    }

    // Hash the password
    const hashedPassword = await hashPassword(password);

    // Create the user
    const newUser = await User.create({
      username,
      email,
      password: hashedPassword,
      role: role || 'user' // Default to 'user' role if not specified
    });

    // Return the user without the password
    const userResponse = newUser.toObject();
    delete userResponse.password;

    res.status(201).json(userResponse);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update a user (admin only)
app.put('/api/users/:id', authMiddleware, async (req, res) => {
  try {
    // Check if the requesting user is an admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
    }

    const userId = req.params.id;
    const { username, email, password, role } = req.body;

    // Find the user to update
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if username or email already exists (excluding the current user)
    if (username || email) {
      const existingUser = await User.findOne({
        _id: { $ne: userId },
        $or: [
          ...(username ? [{ username }] : []),
          ...(email ? [{ email }] : [])
        ]
      });

      if (existingUser) {
        return res.status(400).json({
          error: 'Username or email already in use'
        });
      }
    }

    // Prepare update object
    const updateData = {};
    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (password) {
      updateData.password = await hashPassword(password);
    }

    // Update the user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, select: '-password' }
    );

    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a user (admin only)
app.delete('/api/users/:id', authMiddleware, async (req, res) => {
  try {
    // Check if the requesting user is an admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
    }

    const userId = req.params.id;

    // Don't allow deleting the last admin user
    const adminCount = await User.countDocuments({ role: 'admin' });
    const userToDelete = await User.findById(userId);

    if (!userToDelete) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (userToDelete.role === 'admin' && adminCount <= 1) {
      return res.status(400).json({
        error: 'Cannot delete the last admin user'
      });
    }

    // Delete the user
    await User.findByIdAndDelete(userId);

    res.status(204).end();
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update only social copy fields for a card
app.patch('/api/cards/:id/social-copy', authMiddleware, async (req, res) => {
  try {
    const cardId = req.params.id;
    const { instagramCopy, facebookCopy } = req.body;
    
    // Validate input - at least one field must be provided
    if (instagramCopy === undefined && facebookCopy === undefined) {
      return res.status(400).json({ 
        error: 'At least one of instagramCopy or facebookCopy must be provided' 
      });
    }
    
    // Find the card first to check if it exists
    const card = await Card.findById(cardId);
    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }
    
    // Check if card type supports social copy
    if (card.type !== 'social' && card.type !== 'reel') {
      return res.status(400).json({ 
        error: 'Social copy can only be updated for social and reel card types' 
      });
    }
    
    // Prepare update object with only the provided fields
    const updateData = {};
    if (instagramCopy !== undefined) {
      // If null or empty string after trimming, remove the field
      if (instagramCopy === null || (typeof instagramCopy === 'string' && instagramCopy.trim() === '')) {
        updateData.$unset = { ...updateData.$unset, instagramCopy: "" };
      } else {
        updateData.instagramCopy = instagramCopy;
      }
    }
    
    if (facebookCopy !== undefined) {
      // If null or empty string after trimming, remove the field
      if (facebookCopy === null || (typeof facebookCopy === 'string' && facebookCopy.trim() === '')) {
        updateData.$unset = { ...updateData.$unset, facebookCopy: "" };
      } else {
        updateData.facebookCopy = facebookCopy;
      }
    }
    
    // Update the card with just the social copy fields
    let updateOperation = {};
    
    // Handle both setting and unsetting fields in one operation
    if (Object.keys(updateData).some(key => key !== '$unset')) {
      updateOperation.$set = {};
      Object.entries(updateData).forEach(([key, value]) => {
        if (key !== '$unset') {
          updateOperation.$set[key] = value;
        }
      });
    }
    
    // Add $unset operation if needed
    if (updateData.$unset) {
      updateOperation.$unset = updateData.$unset;
    }
    
    const updatedCard = await Card.findByIdAndUpdate(
      cardId,
      updateOperation,
      { new: true } // Return the updated document
    );
    
    // Convert relative URLs to absolute URLs for response
    const baseUrl = getBaseUrl(req);
    const response = updatedCard.toObject();
    
    Object.keys(response).forEach(key => {
      if (key !== '_id' && key !== 'type' && key !== 'tags' && key !== 'description' &&
          key !== 'metadata' && key !== 'date' && key !== 'createdAt' && key !== 'updatedAt' && 
          key !== 'instagramCopy' && key !== 'facebookCopy' && response[key]) {
        response[key] = baseUrl + response[key];
      }
    });
    
    res.json(response);
  } catch (error) {
    console.error('Error updating social copy:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// API endpoint to get signed URLs for S3 files
app.post('/api/files/signed-url', async (req, res) => {
  try {
    const { fileUrl } = req.body;
    
    if (!fileUrl) {
      return res.status(400).json({ error: 'File URL is required' });
    }
    
    // Check if this is an S3 URL and we have S3 configured
    if (!isS3Configured || (!fileUrl.includes('amazonaws.com') && !fileUrl.includes('s3.'))) {
      return res.status(400).json({ error: 'Not an S3 URL or S3 not configured' });
    }
    
    // Extract the S3 key from the URL
    let s3Key;
    if (fileUrl.includes('amazonaws.com/')) {
      s3Key = fileUrl.split('amazonaws.com/')[1];
    } else {
      // For other S3 URL formats, try to extract the key
      const urlParts = fileUrl.split('/');
      s3Key = urlParts.slice(3).join('/'); // Everything after the domain
    }
    
    console.log(`Generating signed URL for S3 key: ${s3Key}`);
    
    // Generate signed URL (valid for 1 hour)
    const signedUrl = await getSignedFileUrl(s3Key, 3600);
    
    if (!signedUrl) {
      return res.status(500).json({ error: 'Failed to generate signed URL' });
    }
    
    res.json({ signedUrl });
  } catch (error) {
    console.error('Error generating signed URL:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to reset the admin password
async function resetAdminPassword() {
  try {
    const admin = await User.findOne({ username: 'admin' });
    if (!admin) {
      console.log('Admin user not found. Cannot reset password.');
      return;
    }

    // Update the admin user with a new hashed password
    const hashedPassword = await hashPassword(adminUser.password);

    // Make sure email is present
    if (!admin.email) {
      admin.email = 'owner@shopzive.com';
    }

    admin.password = hashedPassword;
    await admin.save();

    console.log('Admin password has been reset successfully.');
  } catch (error) {
    console.error('Error resetting admin password:', error);
  }
}

// Start the application
async function startApp() {
  try {
    // Connect to MongoDB
    await connectToDatabase();

    // Seed the database with initial data if empty
    await seedDatabase();

    // Uncomment this line to reset the admin password if needed
    // await resetAdminPassword();

    // Start the server
    const server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Max file upload size: 500MB`);
      console.log(`Auto-preview generation for videos: Enabled (local & S3)`);
      console.log(`Image sequence support: Enabled`);
    });
    
    // Set longer timeout for large file uploads (10 minutes)
    server.timeout = 600000;
    
    // Schedule cleanup of orphaned ZIP files daily
    setInterval(async () => {
      try {
        await cleanupOrphanedZipFiles();
      } catch (error) {
        console.error('Error in scheduled ZIP cleanup:', error);
      }
    }, 24 * 60 * 60 * 1000); // Run every 24 hours
    
    // Run initial cleanup when starting
    cleanupOrphanedZipFiles().catch(err => {
      console.error('Error in initial ZIP cleanup:', err);
    });
  } catch (error) {
    console.error('Error starting application:', error);
    process.exit(1);
  }
}

// Initialize the application
startApp();
