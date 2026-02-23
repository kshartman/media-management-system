const multer = require('multer');
const path = require('path');
const { VIDEO_DIMENSIONS } = require('../utils/mediaConstants');
const logger = require('../utils/logger');

const uploadLogger = logger.child({ component: 'upload' });

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Use UPLOAD_PATH env var or fall back to local uploads directory
    const uploadPath = process.env.UPLOAD_PATH || path.join(__dirname, '..', 'uploads');
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Create a unique filename while preserving the original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, extension);
    
    // Clean the basename to remove any special characters
    const cleanBaseName = baseName.replace(/[^a-zA-Z0-9]/g, '-');
    
    // Construct the final filename
    const fileName = `${uniqueSuffix}-${cleanBaseName}${extension}`;
    cb(null, fileName);
  }
});

// Enhanced file filter with strict MIME type validation
const fileFilter = (req, file, cb) => {
  // Define allowed MIME types with their corresponding extensions
  const allowedMimeTypes = {
    // Images
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/gif': ['.gif'],
    'image/webp': ['.webp'],
    'image/svg+xml': ['.svg'],
    // Videos
    'video/mp4': ['.mp4'],
    'video/quicktime': ['.mov'],
    'video/x-msvideo': ['.avi'],
    'video/webm': ['.webm'],
    // Documents
    'application/pdf': ['.pdf'],
    'text/plain': ['.txt'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/vnd.apple.pages': ['.pages'],
    // Subtitle files
    'application/x-subrip': ['.srt']
  };

  // Extensions that browsers commonly send as application/octet-stream
  const octetStreamAllowed = ['.srt', '.pages'];

  const fileExt = path.extname(file.originalname).toLowerCase();
  let mimeType = file.mimetype.toLowerCase();

  // Security checks
  if (!file.originalname || file.originalname.trim() === '') {
    uploadLogger.warn('Rejected file upload: Empty filename');
    return cb(new Error('Invalid filename'));
  }

  // Check for suspicious filenames
  const suspiciousPatterns = /\.(exe|bat|cmd|scr|pif|vbs|js|jar|com|pps|php|asp|jsp|htaccess)$/i;
  if (suspiciousPatterns.test(file.originalname)) {
    uploadLogger.warn(`Rejected suspicious file upload: ${file.originalname}`);
    return cb(new Error('File type not allowed for security reasons'));
  }

  // Remap application/octet-stream to the correct MIME type based on extension
  if (mimeType === 'application/octet-stream' && octetStreamAllowed.includes(fileExt)) {
    const remappedMime = Object.entries(allowedMimeTypes)
      .find(([, exts]) => exts.includes(fileExt));
    if (remappedMime) {
      mimeType = remappedMime[0];
      uploadLogger.info(`Remapped MIME type for ${file.originalname}: application/octet-stream → ${mimeType}`);
    }
  }

  // Check if MIME type is allowed
  if (!allowedMimeTypes[mimeType]) {
    uploadLogger.warn(`Rejected file upload - unknown MIME type: ${file.originalname} (${mimeType})`);
    return cb(new Error(`File type ${mimeType} is not allowed`));
  }
  
  // Verify that file extension matches MIME type
  const allowedExtensions = allowedMimeTypes[mimeType];
  if (!allowedExtensions.includes(fileExt)) {
    uploadLogger.warn(`Rejected file upload - MIME/extension mismatch: ${file.originalname} (${mimeType}/${fileExt})`);
    return cb(new Error('File extension does not match file type'));
  }
  
  // Additional size check per file type
  const maxSizes = {
    'image/jpeg': 50 * 1024 * 1024,    // 50MB for images
    'image/png': 50 * 1024 * 1024,
    'image/gif': 20 * 1024 * 1024,     // 20MB for GIFs
    'image/webp': 30 * 1024 * 1024,
    'image/svg+xml': 5 * 1024 * 1024,  // 5MB for SVG
    'video/mp4': 500 * 1024 * 1024,    // 500MB for videos
    'video/quicktime': 500 * 1024 * 1024,
    'video/x-msvideo': 500 * 1024 * 1024,
    'video/webm': 500 * 1024 * 1024,
    'application/pdf': 25 * 1024 * 1024, // 25MB for PDFs
    'text/plain': 10 * 1024 * 1024,     // 10MB for text files
    'application/msword': 25 * 1024 * 1024,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 25 * 1024 * 1024,
    'application/vnd.apple.pages': 25 * 1024 * 1024,
    'application/x-subrip': 5 * 1024 * 1024
  };
  
  // Note: We can't check file size here as it's not available yet
  // Size validation will be done in the upload middleware
  
  uploadLogger.info(`Accepted file upload: ${file.originalname} (${mimeType})`);
  cb(null, true);
};

// Create the multer upload instance
const upload = multer({
  storage: storage,
  limits: { 
    fileSize: 500 * 1024 * 1024, // 500MB limit
    files: 100 // Allow up to 100 files (for image sequences)
  },
  fileFilter: fileFilter
});

// Dynamic upload handler for card uploads
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
      uploadLogger.warn(`Missing required file field: ${field}`);
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
  uploadLogger.debug('Received files:');
  if (!files) {
    uploadLogger.debug('  No files received');
    return;
  }

  Object.keys(files).forEach(fieldName => {
    const file = files[fieldName][0];
    if (file) {
      uploadLogger.debug(`  ${fieldName}: ${file.originalname} (${file.mimetype}, ${Math.round(file.size/1024)}KB)`);
    }
  });
};

module.exports = {
  upload,
  handleCardUpload,
  validateFiles,
  preserveOriginalFileName,
  validateCardType,
  logReceivedFiles
};