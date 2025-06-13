const mongoose = require('mongoose');
const logger = require('../utils/logger');
require('dotenv').config();

// Create a child logger for database operations
const dbLogger = logger.child({ component: 'database' });

// Connect to MongoDB
async function connectToDatabase() {
  try {
    // Extract database name from authSource, env var, or use media-management as default
    const defaultDbName = process.env.MONGODB_DB_NAME || 'media-management';
    const authSourceMatch = process.env.MONGODB_URI.match(/authSource=([^&]+)/);
    const dbName = authSourceMatch ? authSourceMatch[1] : defaultDbName;

    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: dbName // Explicitly set the database name
    });
    dbLogger.info('Connected to MongoDB successfully!');
    return mongoose.connection;
  } catch (error) {
    dbLogger.error('MongoDB connection error:', error);
    dbLogger.error('Please check your MongoDB credentials and make sure the database is accessible');
    process.exit(1);
  }
}

module.exports = { connectToDatabase };