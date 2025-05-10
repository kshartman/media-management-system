const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
async function connectToDatabase() {
  try {
    // Explicitly specify the database name
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: 'media-management'
    });
    console.log('Connected to MongoDB successfully!');
    return mongoose.connection;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

module.exports = { connectToDatabase };