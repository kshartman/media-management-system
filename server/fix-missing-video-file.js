#!/usr/bin/env node

/**
 * Script to fix the specific missing video file issue
 * 
 * This script addresses the issue where a card references a video file that doesn't exist:
 * Card ID: 684a7b233e99c1f8036dadca
 * Missing file: /uploads/1749711651194-dqauvi-Zive_7_-_NSF_Certified_Sport_and_Why_it_s_So_Important.mp4
 * 
 * The script will:
 * 1. Verify the file is missing
 * 2. Check if a similar file exists in S3
 * 3. Offer options to fix the issue
 */

const fs = require('fs');
const path = require('path');
const { S3Client, ListObjectsV2Command, HeadObjectCommand } = require('@aws-sdk/client-s3');
const mongoose = require('mongoose');
const { Card } = require('./models');
const logger = require('./utils/logger');
require('dotenv').config();

// Create child logger for this script
const scriptLogger = logger.child({ module: 'fix-missing-video' });

// Configuration
const CARD_ID = '684a7b233e99c1f8036dadca';
const PROBLEMATIC_FILE = '/uploads/1749711651194-dqauvi-Zive_7_-_NSF_Certified_Sport_and_Why_it_s_So_Important.mp4';
const DRY_RUN = true; // Set to false to apply changes

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
    const defaultDbName = process.env.MONGODB_DB_NAME || 'media-management';
    const authSourceMatch = process.env.MONGODB_URI.match(/authSource=([^&]+)/);
    const dbName = authSourceMatch ? authSourceMatch[1] : defaultDbName;

    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: dbName
    });
    scriptLogger.info('Connected to MongoDB successfully!');
    return mongoose.connection;
  } catch (error) {
    scriptLogger.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

// Check if a file exists in S3
async function checkFileExistsInS3(bucketName, key) {
  try {
    const command = new HeadObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    await s3Client.send(command);
    return true;
  } catch (error) {
    if (error.name === 'NotFound') {
      return false;
    }
    throw error;
  }
}

// Search for similar files in S3
async function findSimilarFilesInS3(bucketName, searchTerm) {
  try {
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: 'dams/',
    });
    
    const response = await s3Client.send(command);
    const similarFiles = [];
    
    if (response.Contents) {
      for (const object of response.Contents) {
        if (object.Key.includes(searchTerm)) {
          similarFiles.push(object.Key);
        }
      }
    }
    
    return similarFiles;
  } catch (error) {
    scriptLogger.error('Error searching S3:', error);
    return [];
  }
}

// Extract filename from path
function extractFilename(filePath) {
  return path.basename(filePath);
}

// Main function to diagnose and fix the issue
async function fixMissingVideoFile() {
  try {
    await connectToDatabase();
    
    scriptLogger.info(`Analyzing missing video file issue for card: ${CARD_ID}`);
    scriptLogger.info(`Problematic file path: ${PROBLEMATIC_FILE}`);
    
    // 1. Find the card in the database
    const card = await Card.findById(CARD_ID);
    if (!card) {
      scriptLogger.error(`Card with ID ${CARD_ID} not found`);
      return;
    }
    
    scriptLogger.info(`Found card: "${card.description}"`);
    scriptLogger.info(`Card type: ${card.type}`);
    scriptLogger.info(`Current movie path: ${card.movie}`);
    
    // 2. Extract filename for searching
    const filename = extractFilename(PROBLEMATIC_FILE);
    scriptLogger.info(`Extracted filename: ${filename}`);
    
    // 3. Check if file exists in various S3 locations
    const bucketName = process.env.S3_BUCKET;
    const possibleS3Keys = [
      `dams/${filename}`,
      `dams/uploads/${filename}`,
      `uploads/${filename}`,
      filename
    ];
    
    scriptLogger.info('Checking possible S3 locations...');
    let foundS3Key = null;
    
    for (const key of possibleS3Keys) {
      const exists = await checkFileExistsInS3(bucketName, key);
      scriptLogger.info(`Checking ${key}: ${exists ? 'EXISTS' : 'NOT FOUND'}`);
      if (exists) {
        foundS3Key = key;
        break;
      }
    }
    
    // 4. If not found, search for similar files
    if (!foundS3Key) {
      scriptLogger.info('File not found in expected locations. Searching for similar files...');
      
      // Extract a search term from the filename
      const searchTerms = [
        '1749711651194',
        'Zive_7',
        'NSF_Certified_Sport'
      ];
      
      let similarFiles = [];
      for (const term of searchTerms) {
        const files = await findSimilarFilesInS3(bucketName, term);
        similarFiles = [...similarFiles, ...files];
      }
      
      // Remove duplicates
      similarFiles = [...new Set(similarFiles)];
      
      if (similarFiles.length > 0) {
        scriptLogger.info(`Found ${similarFiles.length} similar file(s):`);
        similarFiles.forEach(file => scriptLogger.info(`  - ${file}`));
      } else {
        scriptLogger.warn('No similar files found in S3');
      }
    }
    
    // 5. Check local file system
    const localPaths = [
      path.join(__dirname, 'uploads', filename),
      path.join(__dirname, '..', 'uploads', filename)
    ];
    
    let foundLocalPath = null;
    for (const localPath of localPaths) {
      if (fs.existsSync(localPath)) {
        foundLocalPath = localPath;
        scriptLogger.info(`Found local file: ${localPath}`);
        break;
      }
    }
    
    if (!foundLocalPath) {
      scriptLogger.info('File not found in local storage');
    }
    
    // 6. Provide solution options
    scriptLogger.info('\n=== SOLUTION OPTIONS ===');
    
    if (foundS3Key) {
      // Option 1: Update database to point to correct S3 location
      const correctS3Url = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${foundS3Key}`;
      scriptLogger.info(`OPTION 1: Update database to point to correct S3 URL`);
      scriptLogger.info(`  Current: ${card.movie}`);
      scriptLogger.info(`  New:     ${correctS3Url}`);
      
      if (!DRY_RUN) {
        await Card.findByIdAndUpdate(CARD_ID, { movie: correctS3Url });
        scriptLogger.info('✅ Database updated successfully!');
      } else {
        scriptLogger.info('🔍 DRY RUN: Would update database');
      }
    } else if (foundLocalPath) {
      // Option 2: Upload local file to S3 and update database
      scriptLogger.info(`OPTION 2: Upload local file to S3 and update database`);
      scriptLogger.info(`  Local file: ${foundLocalPath}`);
      scriptLogger.info(`  S3 destination: dams/${filename}`);
      
      if (!DRY_RUN) {
        const { uploadLocalFileToS3 } = require('./utils/s3Storage');
        const s3Url = await uploadLocalFileToS3(foundLocalPath, filename);
        if (s3Url) {
          await Card.findByIdAndUpdate(CARD_ID, { movie: s3Url });
          scriptLogger.info('✅ File uploaded and database updated successfully!');
        } else {
          scriptLogger.error('❌ Failed to upload file to S3');
        }
      } else {
        scriptLogger.info('🔍 DRY RUN: Would upload file to S3 and update database');
      }
    } else {
      // Option 3: Mark file as missing or remove reference
      scriptLogger.info(`OPTION 3: File is missing - need manual intervention`);
      scriptLogger.info(`Possible actions:`);
      scriptLogger.info(`  - Set movie field to null to remove broken reference`);
      scriptLogger.info(`  - Add a note to the card description about missing file`);
      scriptLogger.info(`  - Delete the card if the video is essential`);
      
      if (!DRY_RUN) {
        // For this case, we'll just log the issue and not make automatic changes
        scriptLogger.warn('⚠️  Manual intervention required - file not found anywhere');
      } else {
        scriptLogger.info('🔍 DRY RUN: Would require manual intervention');
      }
    }
    
    // 7. Additional diagnostics
    scriptLogger.info('\n=== ADDITIONAL DIAGNOSTICS ===');
    scriptLogger.info(`Card created at: ${card.createdAt}`);
    scriptLogger.info(`Card updated at: ${card.updatedAt}`);
    
    if (card.fileMetadata) {
      scriptLogger.info(`Original filename: ${card.fileMetadata.movieOriginalFileName || 'N/A'}`);
      scriptLogger.info(`File size: ${card.fileMetadata.fileSize ? `${Math.round(card.fileMetadata.fileSize / 1024 / 1024)} MB` : 'N/A'}`);
    }
    
  } catch (error) {
    scriptLogger.error('Error fixing missing video file:', error);
  } finally {
    await mongoose.connection.close();
    scriptLogger.info('Database connection closed');
  }
}

// Run the script
if (require.main === module) {
  scriptLogger.info('Starting missing video file fix script...');
  scriptLogger.info(`DRY RUN: ${DRY_RUN ? 'ENABLED (no changes will be made)' : 'DISABLED (changes will be applied)'}`);
  
  fixMissingVideoFile()
    .then(() => {
      scriptLogger.info('Script completed');
      process.exit(0);
    })
    .catch(error => {
      scriptLogger.error('Script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixMissingVideoFile };