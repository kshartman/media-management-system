/**
 * Script to migrate existing files from local storage to S3
 * 
 * This script:
 * 1. Scans the local uploads directory
 * 2. Uploads each file to S3 in the 'dams' folder
 * 3. Updates the database records to point to the new S3 paths
 */

const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const mongoose = require('mongoose');
const { Card } = require('../models');
const { getFileUrl } = require('../utils/s3Storage');
const logger = require('../utils/logger');
require('dotenv').config();

// Create child logger for migration
const migrationLogger = logger.child({ module: 'migration' });

// Configuration
const LOCAL_UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const S3_FOLDER = 'dams';
const DRY_RUN = false; // Set to true to simulate without making changes

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

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
    migrationLogger.info('Connected to MongoDB successfully!');
    return mongoose.connection;
  } catch (error) {
    migrationLogger.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

// Get all files in the uploads directory
function getLocalFiles() {
  try {
    const files = fs.readdirSync(LOCAL_UPLOADS_DIR);
    return files.filter(file => {
      const filePath = path.join(LOCAL_UPLOADS_DIR, file);
      return fs.statSync(filePath).isFile();
    });
  } catch (error) {
    migrationLogger.error('Error reading uploads directory:', error);
    return [];
  }
}

// Upload a file to S3
async function uploadFileToS3(fileName) {
  const filePath = path.join(LOCAL_UPLOADS_DIR, fileName);

  // Verify the file exists
  if (!fs.existsSync(filePath)) {
    migrationLogger.error(`File not found: ${filePath}`);
    return null;
  }

  const fileContent = fs.readFileSync(filePath);
  const s3Key = `${S3_FOLDER}/${fileName}`;
  const contentType = getContentType(fileName);

  try {
    if (DRY_RUN) {
      migrationLogger.info(`[DRY RUN] Would upload ${fileName} to S3 at ${s3Key}`);
      return s3Key;
    }

    migrationLogger.info(`Uploading ${fileName} (${fileContent.length} bytes, ${contentType}) to S3 bucket: ${process.env.S3_BUCKET}, key: ${s3Key}`);

    // Log the S3 configuration for debugging
    migrationLogger.debug(`S3 Configuration:
    - Bucket: ${process.env.S3_BUCKET}
    - Region: ${process.env.AWS_REGION}
    - Access Key: ${process.env.AWS_ACCESS_KEY_ID.substring(0, 4)}...
    - Folder: ${S3_FOLDER}
    `);

    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: s3Key,
      Body: fileContent,
      ContentType: contentType
    });

    const response = await s3Client.send(command);
    migrationLogger.info(`Successfully uploaded ${fileName} to S3 at ${s3Key}`);
    migrationLogger.debug(`S3 response:`, response);
    return s3Key;
  } catch (error) {
    migrationLogger.error(`Error uploading ${fileName} to S3:`, error);
    migrationLogger.error(`Error details: ${error.message}`);
    if (error.Code) {
      migrationLogger.error(`AWS Error Code: ${error.Code}`);
    }
    if (error.$metadata) {
      migrationLogger.error(`AWS Metadata:`, error.$metadata);
    }
    throw error;
  }
}

// Helper to determine content type based on file extension
function getContentType(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  const contentTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.webm': 'video/webm',
  };
  
  return contentTypes[ext] || 'application/octet-stream';
}

// Update database records to point to S3 URLs
async function updateDatabaseRecords(fileNameToS3Key) {
  migrationLogger.info('Updating database records...');
  
  try {
    // Get all cards from the database
    const cards = await Card.find({});
    migrationLogger.info(`Found ${cards.length} cards in the database`);
    
    let updatedCount = 0;
    
    for (const card of cards) {
      let updated = false;
      const updatedCard = { ...card.toObject() };
      
      // Check and update preview field
      if (card.preview && card.preview.includes('/uploads/')) {
        const fileName = path.basename(card.preview);
        if (fileNameToS3Key[fileName]) {
          // Generate S3 URL for the file
          const s3Url = `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileNameToS3Key[fileName]}`;
          updatedCard.preview = s3Url;
          migrationLogger.debug(`Updating preview for card ${card._id}: ${card.preview} -> ${s3Url}`);
          updated = true;
        }
      }

      // Check and update other fields based on card type
      if (card.type === 'image' && card.download && card.download.includes('/uploads/')) {
        const fileName = path.basename(card.download);
        if (fileNameToS3Key[fileName]) {
          const s3Url = `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileNameToS3Key[fileName]}`;
          updatedCard.download = s3Url;
          migrationLogger.debug(`Updating download for card ${card._id}: ${card.download} -> ${s3Url}`);
          updated = true;
        }
      } else if (card.type === 'social' && card.documentCopy && card.documentCopy.includes('/uploads/')) {
        const fileName = path.basename(card.documentCopy);
        if (fileNameToS3Key[fileName]) {
          const s3Url = `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileNameToS3Key[fileName]}`;
          updatedCard.documentCopy = s3Url;
          migrationLogger.debug(`Updating documentCopy for card ${card._id}: ${card.documentCopy} -> ${s3Url}`);
          updated = true;
        }
      } else if (card.type === 'reel') {
        if (card.movie && card.movie.includes('/uploads/')) {
          const fileName = path.basename(card.movie);
          if (fileNameToS3Key[fileName]) {
            const s3Url = `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileNameToS3Key[fileName]}`;
            updatedCard.movie = s3Url;
            migrationLogger.debug(`Updating movie for card ${card._id}: ${card.movie} -> ${s3Url}`);
            updated = true;
          }
        }
        if (card.transcript && card.transcript.includes('/uploads/')) {
          const fileName = path.basename(card.transcript);
          if (fileNameToS3Key[fileName]) {
            const s3Url = `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileNameToS3Key[fileName]}`;
            updatedCard.transcript = s3Url;
            migrationLogger.debug(`Updating transcript for card ${card._id}: ${card.transcript} -> ${s3Url}`);
            updated = true;
          }
        }
      }
      
      if (updated) {
        if (DRY_RUN) {
          migrationLogger.info(`[DRY RUN] Would update card ${card._id}`);
        } else {
          await Card.updateOne({ _id: card._id }, updatedCard);
          migrationLogger.debug(`Updated card ${card._id}`);
        }
        updatedCount++;
      }
    }
    
    migrationLogger.info(`Updated ${updatedCount} cards in the database`);
  } catch (error) {
    migrationLogger.error('Error updating database records:', error);
    throw error;
  }
}

// Main migration function
async function migrateFilesToS3() {
  try {
    // Connect to the database
    await connectToDatabase();
    
    // Get all local files
    const localFiles = getLocalFiles();
    migrationLogger.info(`Found ${localFiles.length} files in local storage`);
    
    // Map to store file name to S3 key mapping
    const fileNameToS3Key = {};
    
    // Upload each file to S3
    for (const fileName of localFiles) {
      try {
        const s3Key = await uploadFileToS3(fileName);
        fileNameToS3Key[fileName] = s3Key;
      } catch (error) {
        migrationLogger.error(`Error processing file ${fileName}:`, error);
        // Continue with other files even if one fails
      }
    }
    
    // Update database records
    await updateDatabaseRecords(fileNameToS3Key);
    
    migrationLogger.info('Migration completed successfully!');
    
    if (DRY_RUN) {
      migrationLogger.info('\nThis was a DRY RUN. No actual changes were made.');
      migrationLogger.info('Set DRY_RUN = false to perform the actual migration.');
    }
  } catch (error) {
    migrationLogger.error('Migration failed:', error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    migrationLogger.info('Database connection closed');
    process.exit(0);
  }
}

// Start the migration
migrateFilesToS3();