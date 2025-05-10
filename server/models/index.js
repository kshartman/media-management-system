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
}, { timestamps: true });

// User Schema
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
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