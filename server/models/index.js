const mongoose = require('mongoose');

// Tag Schema
const tagSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true, // This already creates an index
    trim: true
  },
  count: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

// Card Schema
const cardSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['image', 'social', 'reel']
  },
  description: {
    type: String,
    required: true
  },
  tags: [String],
  preview: String, // Optional for all card types
  download: {
    type: String,
    required: function() { return this.type === 'image'; } // Required for image type
  },
  imageSequence: {
    type: [String],
    required: function() { return this.type === 'social'; }, // Required for social type
    validate: {
      validator: function(v) {
        // For new social cards, require at least one image
        // For existing social cards being updated, allow empty arrays
        return this.type !== 'social' || 
               (Array.isArray(v) && v.length > 0) || 
               (this.isNew === false); // Skip validation for existing documents
      },
      message: props => 'At least one image is required in the image sequence for social cards'
    }
  },
  movie: {
    type: String,
    required: function() { return this.type === 'reel'; } // Required for reel type
  },
  transcript: {
    type: String,
    // Transcript is now optional for reel cards
  },
  instagramCopy: {
    type: String,
    // Optional rich text content for Instagram posts
  },
  facebookCopy: {
    type: String,
    // Optional rich text content for Facebook posts
  },
  // File metadata
  fileMetadata: {
    date: {
      type: Date,
      default: Date.now
    },
    width: Number,  // For images and videos
    height: Number, // For images and videos
    fileSize: Number, // In bytes
    totalSequenceSize: Number, // Total size of all images in a sequence
    imageSequenceCount: Number, // Number of images in the sequence
    originalFileName: String, // Store original filename for display
    previewOriginalFileName: String, // For preview images
    downloadOriginalFileName: String, // For downloadable files
    movieOriginalFileName: String, // For movie files (reel cards)
    transcriptOriginalFileName: String, // For transcript files (reel and social cards)
    instagramCopyOriginalFileName: String, // For Instagram copy
    facebookCopyOriginalFileName: String, // For Facebook copy
    imageSequenceOriginalFileNames: [String], // Original filenames for image sequence
    imageSequenceFileSizes: [Number], // Sizes of each image in the sequence in bytes
    previewSource: {
      type: String,
      enum: ['auto-generated', 'user-uploaded', 'fallback'],
      default: 'auto-generated' // Track how the preview was created
    }
  }
}, { timestamps: true });

// User Schema
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email address']
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'user'],
    default: 'user'
  },
  resetPasswordToken: {
    type: String,
    default: null
  },
  resetPasswordExpires: {
    type: Date,
    default: null
  }
}, { timestamps: true });

// Initialize models
const models = {};

// Only create models if they don't already exist
models.Card = mongoose.models.Card || mongoose.model('Card', cardSchema);
models.User = mongoose.models.User || mongoose.model('User', userSchema);
models.Tag = mongoose.models.Tag || mongoose.model('Tag', tagSchema);

module.exports = models;