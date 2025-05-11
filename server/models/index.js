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
  documentCopy: {
    type: String,
    required: function() { return this.type === 'social'; } // Required for social type
  },
  movie: {
    type: String,
    required: function() { return this.type === 'reel'; } // Required for reel type
  },
  transcript: {
    type: String,
    required: function() { return this.type === 'reel'; } // Required for reel type
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
    originalFileName: String, // Store original filename for display
    previewOriginalFileName: String, // For preview images
    downloadOriginalFileName: String, // For downloadable files
    documentCopyOriginalFileName: String, // For document copies (social cards)
    movieOriginalFileName: String, // For movie files (reel cards)
    transcriptOriginalFileName: String // For transcript files (reel cards)
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
  }
}, { timestamps: true });

// Initialize models
const models = {};

// Only create models if they don't already exist
models.Card = mongoose.models.Card || mongoose.model('Card', cardSchema);
models.User = mongoose.models.User || mongoose.model('User', userSchema);
models.Tag = mongoose.models.Tag || mongoose.model('Tag', tagSchema);

module.exports = models;