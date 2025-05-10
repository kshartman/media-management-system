const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const sizeOf = require('image-size');
const { connectToDatabase } = require('./db/connection');
const { Card, User, Tag } = require('./models');
require('dotenv').config();

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

// Setup multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Remove spaces and special characters from original filename
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${Date.now()}-${sanitizedName}`);
  },
});

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

const sampleUsers = [
  {
    username: 'admin',
    password: 'HealthyGuts4Me!', // In production, use hashed passwords
    role: 'admin',
  },
];

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
      await User.insertMany(sampleUsers);
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
    console.log('[TAG DEBUG SERVER] Getting all tags from database');
    // Get all tags from the dedicated Tag collection
    const tags = await Tag.find({}).sort({ name: 1 });
    console.log('[TAG DEBUG SERVER] Raw tags from database:', tags);
    const tagNames = tags.map(tag => tag.name);
    console.log('[TAG DEBUG SERVER] Returning tag names:', tagNames);
    return tagNames;
  } catch (error) {
    console.error('Error getting all tags:', error);
    return [];
  }
};

// Function to process tags when creating or updating cards
const processTags = async (tagsList) => {
  if (!tagsList || !Array.isArray(tagsList) || tagsList.length === 0) {
    console.log('[TAG DEBUG SERVER] No tags to process');
    return;
  }

  console.log('[TAG DEBUG SERVER] Processing tags:', tagsList);

  try {
    // Process each tag in the list
    for (const tagName of tagsList) {
      const trimmedTag = tagName.trim();
      if (!trimmedTag) {
        console.log('[TAG DEBUG SERVER] Skipping empty tag');
        continue;
      }

      // Try to find the tag
      const existingTag = await Tag.findOne({ name: trimmedTag });

      if (existingTag) {
        console.log(`[TAG DEBUG SERVER] Found existing tag "${trimmedTag}", incrementing count`);
        // Increment the tag usage count
        await Tag.updateOne(
          { _id: existingTag._id },
          { $inc: { count: 1 } }
        );
      } else {
        console.log(`[TAG DEBUG SERVER] Creating new tag "${trimmedTag}"`);
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
    const user = await User.findOne({ username, password });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
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

    // Convert relative URLs to absolute URLs
    const baseUrl = getBaseUrl(req);
    const cardsWithAbsoluteUrls = cards.map(card => {
      const result = card.toObject();
      
      // Convert URLs based on card type
      if (card.type === 'image') {
        if (card.preview) {
          result.preview = baseUrl + card.preview;
        }
        result.download = baseUrl + card.download;
      } else if (card.type === 'social') {
        if (card.preview) {
          result.preview = baseUrl + card.preview;
        }
        result.documentCopy = baseUrl + card.documentCopy;
      } else if (card.type === 'reel') {
        if (card.preview) {
          result.preview = baseUrl + card.preview;
        }
        result.movie = baseUrl + card.movie;
        result.transcript = baseUrl + card.transcript;
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

    // Convert relative URLs to absolute URLs
    const baseUrl = getBaseUrl(req);
    const result = card.toObject();
    
    // Convert URLs based on card type
    if (card.type === 'image') {
      if (card.preview) {
        result.preview = baseUrl + card.preview;
      }
      result.download = baseUrl + card.download;
    } else if (card.type === 'social') {
      if (card.preview) {
        result.preview = baseUrl + card.preview;
      }
      result.documentCopy = baseUrl + card.documentCopy;
    } else if (card.type === 'reel') {
      if (card.preview) {
        result.preview = baseUrl + card.preview;
      }
      result.movie = baseUrl + card.movie;
      result.transcript = baseUrl + card.transcript;
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
    console.log('[TAG DEBUG SERVER] Raw tags received from POST form:', req.body.tags);
    const tags = req.body.tags ? req.body.tags.split(',').map(tag => tag.trim()) : [];
    console.log('[TAG DEBUG SERVER] Processed tags array for POST:', tags);

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

    // Handle different card types
    if (type === 'image') {
      const validation = validateFiles(req.files, ['download']);
      if (!validation.valid) {
        return res.status(400).json({
          error: `Download image is required for image cards. Missing: ${validation.missingField}`
        });
      }
      if (req.files.preview && req.files.preview.length > 0) {
        newCard.preview = `/uploads/${req.files.preview[0].filename}`;
        // Extract metadata for preview image
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
      }
      newCard.download = `/uploads/${req.files.download[0].filename}`;
      // Extract metadata for download image
      const downloadMetadata = await extractFileMetadata(newCard.download, date);
      // Always use the downloadable image metadata over the preview
      newCard.fileMetadata.width = downloadMetadata.width || newCard.fileMetadata.width;
      newCard.fileMetadata.height = downloadMetadata.height || newCard.fileMetadata.height;
      newCard.fileMetadata.fileSize = downloadMetadata.fileSize || newCard.fileMetadata.fileSize;
    } else if (type === 'social') {
      const validation = validateFiles(req.files, ['documentCopy']);
      if (!validation.valid) {
        return res.status(400).json({
          error: `Document copy is required for social cards. Missing: ${validation.missingField}`
        });
      }
      if (req.files.preview && req.files.preview.length > 0) {
        newCard.preview = `/uploads/${req.files.preview[0].filename}`;
        // Extract metadata for preview image
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
      }
      newCard.documentCopy = `/uploads/${req.files.documentCopy[0].filename}`;
      // Extract metadata for document copy
      const documentMetadata = await extractFileMetadata(newCard.documentCopy, date);
      // For documents, we mainly care about file size
      newCard.fileMetadata.fileSize = documentMetadata.fileSize || newCard.fileMetadata.fileSize;
    } else if (type === 'reel') {
      const validation = validateFiles(req.files, ['movie', 'transcript']);
      if (!validation.valid) {
        return res.status(400).json({
          error: `Movie and transcript are required for reel cards. Missing: ${validation.missingField}`
        });
      }
      if (req.files.preview && req.files.preview.length > 0) {
        newCard.preview = `/uploads/${req.files.preview[0].filename}`;
        // Extract metadata for preview image
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
      }
      newCard.movie = `/uploads/${req.files.movie[0].filename}`;
      // Extract metadata for movie file
      const movieMetadata = await extractFileMetadata(newCard.movie, date);
      // For videos, we want dimensions and file size
      newCard.fileMetadata.width = movieMetadata.width || newCard.fileMetadata.width;
      newCard.fileMetadata.height = movieMetadata.height || newCard.fileMetadata.height;
      newCard.fileMetadata.fileSize = movieMetadata.fileSize || newCard.fileMetadata.fileSize;

      newCard.transcript = `/uploads/${req.files.transcript[0].filename}`;
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
    console.log('[TAG DEBUG SERVER] Raw tags received from PUT form:', req.body.tags);
    const tags = req.body.tags ? req.body.tags.split(',').map(tag => tag.trim()) : [];
    console.log('[TAG DEBUG SERVER] Processed tags array for PUT:', tags);
    console.log('[TAG DEBUG SERVER] Existing card tags before update:', card.tags);

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

    // Handle file removal and update flags
    const handleFileField = async (field, currentValue) => {
      const removeFlag = req.body[`remove_${field}`] === 'true';

      if (removeFlag) {
        console.log(`Removing ${field}`);
        // We don't remove fileMetadata as it's a single object for the whole card
        // But we could reset specific fields if needed
        return undefined;
      } else if (req.files && req.files[field] && req.files[field].length > 0) {
        console.log(`Updating ${field} with new file: ${req.files[field][0].filename}`);
        const newPath = `/uploads/${req.files[field][0].filename}`;

        // Extract metadata for the new file
        const metadata = await extractFileMetadata(newPath, date);
        if (!updatedCard.fileMetadata) {
          updatedCard.fileMetadata = {};
        }

        // Update width, height and fileSize but keep the date we set earlier
        if (metadata.width) updatedCard.fileMetadata.width = metadata.width;
        if (metadata.height) updatedCard.fileMetadata.height = metadata.height;
        if (metadata.fileSize) updatedCard.fileMetadata.fileSize = metadata.fileSize;

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

    // Update the card in the database
    const updated = await Card.findByIdAndUpdate(cardId, updatedCard, { new: true });

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

    // Delete the card
    await Card.findByIdAndDelete(cardId);

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

// Start the application
async function startApp() {
  try {
    // Connect to MongoDB
    await connectToDatabase();
    
    // Seed the database with initial data if empty
    await seedDatabase();
    
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