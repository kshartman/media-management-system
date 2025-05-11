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
  isS3Configured, safeDeleteOrphanedFile } = require('./utils/s3Storage');
require('dotenv').config();

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
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3002'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Get the configured storage engine from s3Storage utility
const storage = getStorage();

// File filter to allow all common media file types
const fileFilter = (req, file, cb) => {
  // Check if the file MIME type is allowed
  const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
  const allowedDocumentTypes = ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  const allowedVideoTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];

  // Allow any of these file types
  const allowedTypes = [...allowedImageTypes, ...allowedDocumentTypes, ...allowedVideoTypes];

  // Some browsers don't properly set mime types, so check file extension as fallback
  const extension = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.pdf', '.txt', '.doc', '.docx', '.mp4', '.mov', '.avi', '.webm', '.srt'];

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
    fileSize: 50 * 1024 * 1024 // 50MB limit
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
    documentCopy: '/uploads/sample-social-copy.pdf',
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

// Utility function to extract metadata from uploaded files
const extractFileMetadata = async (filePath, providedDate = null) => {
  try {
    const fullPath = path.join(__dirname, filePath);
    const stats = fs.statSync(fullPath);
    const fileSize = stats.size; // File size in bytes
    const date = providedDate || new Date();
    let width = null;
    let height = null;

    // Get image dimensions for image files
    const extension = path.extname(filePath).toLowerCase();
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];

    if (imageExtensions.includes(extension)) {
      try {
        // Use image-size to get dimensions
        const dimensions = sizeOf(fullPath);
        width = dimensions.width;
        height = dimensions.height;
      } catch (err) {
        console.error('Error getting image dimensions:', err);
      }
    } else if (extension === '.mp4' || extension === '.mov' || extension === '.avi' || extension === '.webm') {
      // For video files, we could use something like ffprobe here
      // But we'll leave this for a future enhancement
      // For now, we'll rely on sharp's metadata extraction capabilities for images only
    }

    return {
      date,
      width,
      height,
      fileSize
    };
  } catch (error) {
    console.error('Error extracting file metadata:', error);
    return {
      date: providedDate || new Date(),
      width: null,
      height: null,
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
      filter.description = { $regex: search, $options: 'i' };
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

// Middleware to handle file uploads for different card types
const handleCardUpload = upload.fields([
  { name: 'preview', maxCount: 1 },
  { name: 'download', maxCount: 1 },
  { name: 'documentCopy', maxCount: 1 },
  { name: 'movie', maxCount: 1 },
  { name: 'transcript', maxCount: 1 },
]);

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
  } else if (type === 'social' && (!files.documentCopy || files.documentCopy.length === 0)) {
    return { valid: false, message: 'Social cards require a document copy file' };
  } else if (type === 'reel' &&
            (!files.movie || files.movie.length === 0 ||
             !files.transcript || files.transcript.length === 0)) {
    return { valid: false, message: 'Reel cards require both movie and transcript files' };
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

    const { type, description } = req.body;
    const tags = req.body.tags ? req.body.tags.split(',').map(tag => tag.trim()) : [];

    // Extract date if provided in the form
    let date = req.body.date ? new Date(req.body.date) : new Date();

    if (!type || !description) {
      return res.status(400).json({ error: 'Type and description are required' });
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

    // Helper function to get file path from multer/multer-s3 file
    const getFilePath = (file) => {
      // If using S3, the file location is stored differently
      if (isS3Configured && file) {
        // For multer-s3, the path is in file.location
        return file.location || file.key || (file.filename ? `/uploads/${file.filename}` : null);
      }

      // For local storage
      return file ? `/uploads/${file.filename}` : null;
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
        newCard.preview = getFilePath(previewFile);

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
      newCard.download = getFilePath(downloadFile);

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
      const validation = validateFiles(req.files, ['documentCopy']);
      if (!validation.valid) {
        return res.status(400).json({
          error: `Document copy is required for social cards. Missing: ${validation.missingField}`
        });
      }

      if (req.files.preview && req.files.preview.length > 0) {
        const previewFile = req.files.preview[0];
        newCard.preview = getFilePath(previewFile);

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

      const documentFile = req.files.documentCopy[0];
      newCard.documentCopy = getFilePath(documentFile);

      // Store original filename in metadata
      preserveOriginalFileName(req, documentFile, 'documentCopy', newCard);

      // Update file size
      if (!isS3Configured) {
        const documentMetadata = await extractFileMetadata(newCard.documentCopy, date);
        // For documents, we mainly care about file size
        newCard.fileMetadata.fileSize = documentMetadata.fileSize || newCard.fileMetadata.fileSize;
      } else {
        // For S3, use the file size from the file object
        if (req.files.documentCopy[0].size) {
          newCard.fileMetadata.fileSize = req.files.documentCopy[0].size;
        }
      }
    } else if (type === 'reel') {
      const validation = validateFiles(req.files, ['movie', 'transcript']);
      if (!validation.valid) {
        return res.status(400).json({
          error: `Movie and transcript are required for reel cards. Missing: ${validation.missingField}`
        });
      }

      if (req.files.preview && req.files.preview.length > 0) {
        const previewFile = req.files.preview[0];
        newCard.preview = getFilePath(previewFile);

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

      const movieFile = req.files.movie[0];
      newCard.movie = getFilePath(movieFile);

      // Store original filename in metadata
      preserveOriginalFileName(req, movieFile, 'movie', newCard);

      // Update file size and metadata
      if (!isS3Configured) {
        const movieMetadata = await extractFileMetadata(newCard.movie, date);
        // For videos, we want dimensions and file size
        newCard.fileMetadata.width = movieMetadata.width || newCard.fileMetadata.width;
        newCard.fileMetadata.height = movieMetadata.height || newCard.fileMetadata.height;
        newCard.fileMetadata.fileSize = movieMetadata.fileSize || newCard.fileMetadata.fileSize;
      } else {
        // For S3, use the file size from the file object
        if (movieFile.size) {
          newCard.fileMetadata.fileSize = movieFile.size;
        }
      }

      const transcriptFile = req.files.transcript[0];
      newCard.transcript = getFilePath(transcriptFile);

      // Store original filename in metadata
      preserveOriginalFileName(req, transcriptFile, 'transcript', newCard);
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

    const { type, description } = req.body;
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

    // Helper function to get file path from multer/multer-s3 file
    const getFilePath = (file) => {
      // If using S3, the file location is stored differently
      if (isS3Configured && file) {
        // For multer-s3, the path is in file.location
        return file.location || file.key || (file.filename ? `/uploads/${file.filename}` : null);
      }

      // For local storage
      return file ? `/uploads/${file.filename}` : null;
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
        const newPath = getFilePath(file);

        // Check if the old file is orphaned after updating the database record
        if (currentValue) {
          try {
            // Save current card ID to correctly check for orphaned files
            const currentCardId = card._id.toString();

            // First update database with the new file path (temporary update)
            const oldCardData = await Card.findByIdAndUpdate(
              currentCardId,
              { [field]: newPath },
              { new: false }  // return the old document
            );

            // Now check if the old file is orphaned
            const wasDeleted = await safeDeleteOrphanedFile(currentValue, Card);
            if (wasDeleted) {
              console.log(`Orphaned previous file ${currentValue} deleted successfully`);
            } else {
              console.log(`Previous file ${currentValue} still in use by other cards, not deleted`);
            }

            // Revert the database change - full update will happen later
            await Card.findByIdAndUpdate(currentCardId, oldCardData);
          } catch (err) {
            console.error(`Error safely deleting previous file ${currentValue}:`, err);
            // Continue even if deletion fails
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

      // Handle documentCopy field (required for social cards)
      updatedCard.documentCopy = await handleFileField('documentCopy', card.documentCopy);

      // Ensure documentCopy field is present for social cards
      if (!updatedCard.documentCopy) {
        return res.status(400).json({
          error: 'Document copy is required for social cards. Please upload a new file.'
        });
      }
    } else if (type === 'reel') {
      // Handle preview field (optional)
      updatedCard.preview = await handleFileField('preview', card.preview);

      // Handle movie field (required for reel cards)
      updatedCard.movie = await handleFileField('movie', card.movie);

      // Handle transcript field (required for reel cards)
      updatedCard.transcript = await handleFileField('transcript', card.transcript);

      // Ensure required fields are present for reel cards
      if (!updatedCard.movie || !updatedCard.transcript) {
        return res.status(400).json({
          error: 'Movie and transcript are required for reel cards. Please upload new files.'
        });
      }
    }

    // Get a copy of the original card for checking orphaned files
    const originalCard = card.toObject();

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
    const updated = await Card.findByIdAndUpdate(cardId, updateOperation, { new: true });

    // Check if any files were replaced and are now orphaned
    const fieldsToCheck = ['preview', 'download', 'documentCopy', 'movie', 'transcript'];
    for (const field of fieldsToCheck) {
      // Check if the field existed in the original card and was changed or removed
      if (originalCard[field] &&
         (updatedCard[field] !== originalCard[field] || !updatedCard[field])) {

        // Check if the old file is now orphaned
        try {
          const wasDeleted = await safeDeleteOrphanedFile(originalCard[field], Card);
          if (wasDeleted) {
            console.log(`Orphaned file ${originalCard[field]} deleted successfully`);
          } else {
            console.log(`File ${originalCard[field]} still in use by other cards, not deleted`);
          }
        } catch (err) {
          console.error(`Error safely deleting file ${originalCard[field]}:`, err);
        }
      }
    }

    // Convert relative URLs to absolute URLs for response
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
    } else if (card.type === 'social' && card.documentCopy) {
      filesToCheck.push(card.documentCopy);
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
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Error starting application:', error);
    process.exit(1);
  }
}

// Initialize the application
startApp();