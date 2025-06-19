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

// File filter to accept only certain file types
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|svg|mp4|mov|avi|webm|pdf|txt|doc|docx|pages/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    uploadLogger.warn(`Rejected file upload: ${file.originalname} (${file.mimetype})`);
    cb(new Error('Only image, video, and document files are allowed'));
  }
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