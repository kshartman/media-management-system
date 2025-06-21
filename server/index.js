const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { connectToDatabase } = require('./db/connection');
const { Card, User, Tag } = require('./models');
const { isEmailConfigured, sendWelcomeEmail } = require('./utils/emailService');
const { cleanupOrphanedZipFiles } = require('./utils/cleanupOrphanedFiles');
const { startTrashCleanupScheduler } = require('./utils/trashCleanup');
const logger = require('./utils/logger');
const { scrypt, randomBytes } = require('crypto');
const { promisify } = require('util');
require('dotenv').config();

// Import route modules
const authRoutes = require('./routes/auth');
const cardRoutes = require('./routes/cards');
const healthRoutes = require('./routes/health');
const fileRoutes = require('./routes/files');
const tagRoutes = require('./routes/tags');
const userRoutes = require('./routes/users');
const debugRoutes = require('./routes/debug');

// Create child loggers for different components
const dbLogger = logger.child({ component: 'database' });
const authLogger = logger.child({ component: 'auth' });
const apiLogger = logger.child({ component: 'api' });

// Promisify crypto functions
const scryptAsync = promisify(scrypt);
const randomBytesAsync = promisify(randomBytes);

// Constants
const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const CORS_ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:3000',
  'http://localhost:5000',
  'https://resources.shopzive.com'
];

// Helper function to check if a password is already hashed
function isAlreadyHashed(password) {
  return typeof password === 'string' && password.includes(':') && password.length > 64;
}

// Helper function to hash passwords
async function hashPassword(password) {
  const salt = (await randomBytesAsync(16)).toString('hex');
  const derivedKey = await scryptAsync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

// Initialize database with sample data if empty
async function seedDatabase() {
  try {
    // Check if we have any cards
    const cardCount = await Card.countDocuments();
    dbLogger.info(`Found ${cardCount} cards in database`);

    // Check if we have any users
    const userCount = await User.countDocuments();
    dbLogger.info(`Found ${userCount} users in database`);

    if (userCount === 0) {
      dbLogger.info('No users found, creating admin user...');
      
      // Create admin user
      const adminUser = {
        username: 'admin',
        email: 'admin@example.com',
        password: 'admin123', // This will be hashed below
        role: 'admin'
      };

      // Hash the password
      const hashedPassword = await hashPassword(adminUser.password);
      adminUser.password = hashedPassword;

      await User.create(adminUser);
      dbLogger.info('Admin user created successfully');
    }

    // Check and hash any existing plain text passwords
    const usersWithPlainPasswords = await User.find({});
    for (const user of usersWithPlainPasswords) {
      if (!isAlreadyHashed(user.password)) {
        dbLogger.info(`Hashing password for user: ${user.username}`);
        user.password = await hashPassword(user.password);
        await user.save();
      }
    }

  } catch (error) {
    dbLogger.error('Error seeding database:', error);
  }
}

// Initialize the application
async function initializeApp() {
  try {
    // Connect to database
    await connectToDatabase();
    
    // Seed database with initial data
    await seedDatabase();
    
    dbLogger.warn('Database initialization completed');
  } catch (error) {
    dbLogger.error('Failed to initialize database:', error);
    process.exit(1);
  }
}

// Create Express app
const app = express();

// Trust proxy for proper HTTPS detection behind reverse proxy
app.set('trust proxy', 1);

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (CORS_ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      apiLogger.warn(`CORS: Blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from uploads directory
// Use UPLOAD_PATH env var or default to /uploads (the mounted volume)
const uploadPath = process.env.UPLOAD_PATH || '/uploads';
app.use('/uploads', express.static(uploadPath));

// Request logging middleware
app.use((req, res, next) => {
  apiLogger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    hasAuth: !!req.headers.authorization
  });
  next();
});

// Setup routes
apiLogger.warn('Setting up route handlers...');

// Health routes (no prefix needed as they handle both /health and /api/health)
app.use('/', healthRoutes);

// Authentication routes
app.use('/api/auth', authRoutes);

// Card routes
app.use('/api/cards', cardRoutes);

// File routes
app.use('/api', fileRoutes);

// Tag routes
app.use('/api/tags', tagRoutes);

// User routes
app.use('/api/users', userRoutes);

// Debug routes
app.use('/api/debug', debugRoutes);

// Fallback route for undefined endpoints
app.use('*', (req, res) => {
  apiLogger.warn(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((error, req, res, next) => {
  apiLogger.error('Global error handler:', error);
  
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Maximum size is 500MB.' });
  }
  
  if (error.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS: Origin not allowed' });
  }
  
  res.status(500).json({ error: 'Internal server error' });
});

// Helper function to reset the admin password
async function resetAdminPassword() {
  try {
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      apiLogger.warn('No admin user found to reset password');
      return;
    }

    const newPassword = 'admin123';
    const hashedPassword = await hashPassword(newPassword);
    
    adminUser.password = hashedPassword;
    await adminUser.save();
    
    apiLogger.info(`Admin password reset for user: ${adminUser.username}`);
    return newPassword;
  } catch (error) {
    apiLogger.error('Error resetting admin password:', error);
  }
}

// Cleanup function for orphaned ZIP files
async function performCleanup() {
  try {
    await cleanupOrphanedZipFiles();
    apiLogger.warn('Cleanup completed successfully');
  } catch (error) {
    apiLogger.error('Error during cleanup:', error);
  }
}

// Start the server
async function startServer() {
  try {
    await initializeApp();
    
    // Perform initial cleanup
    await performCleanup();
    
    // Schedule cleanup every hour
    setInterval(performCleanup, 60 * 60 * 1000);
    
    // Start trash cleanup scheduler (30-day retention, check daily)
    startTrashCleanupScheduler(30, 24);
    
    app.listen(PORT, () => {
      apiLogger.info(`🚀 Server running on port ${PORT}`);
      apiLogger.info(`📁 Serving static files from: ${uploadPath}`);
      apiLogger.info(`🔒 CORS enabled for origins: ${CORS_ALLOWED_ORIGINS.join(', ')}`);
      apiLogger.info(`📧 Email service: ${isEmailConfigured() ? 'Configured' : 'Not configured'}`);
      apiLogger.info('✅ Media Management System API is ready');
    });
  } catch (error) {
    apiLogger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  apiLogger.warn('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  apiLogger.warn('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  apiLogger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  apiLogger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();

// Export for testing
module.exports = app;