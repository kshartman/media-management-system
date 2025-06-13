#!/usr/bin/env node

/**
 * Script to fix broken file references in the database
 * 
 * This script identifies and fixes cards that reference files that don't exist.
 * It provides options to:
 * 1. Remove broken references (set to null)
 * 2. Add notes about missing files
 * 3. Generate reports of missing files
 */

const fs = require('fs');
const path = require('path');
const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');
const mongoose = require('mongoose');
const { Card } = require('../models');
const { getFilenameFromUrl, isS3Configured } = require('../utils/s3Storage');
const logger = require('../utils/logger');
require('dotenv').config();

// Create child logger for this script
const scriptLogger = logger.child({ module: 'fix-broken-references' });

// Configuration
const DRY_RUN = true; // Set to false to apply changes
const SPECIFIC_CARD_ID = process.argv[2]; // Optional: fix specific card

// Initialize S3 client
const s3Client = isS3Configured ? new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
}) : null;

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
async function checkFileExistsInS3(url) {
  if (!s3Client || !url) return false;
  
  try {
    // Extract bucket and key from S3 URL
    const bucketName = process.env.S3_BUCKET;
    let key;
    
    if (url.includes('amazonaws.com/')) {
      key = url.split('amazonaws.com/')[1];
    } else if (url.includes(process.env.S3_CUSTOM_DOMAIN)) {
      key = url.split(`${process.env.S3_CUSTOM_DOMAIN}/`)[1];
    } else {
      return false;
    }
    
    const command = new HeadObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    
    await s3Client.send(command);
    return true;
  } catch (error) {
    if (error.name === 'NotFound' || error.name === 'NoSuchKey') {
      return false;
    }
    scriptLogger.error(`Error checking S3 file ${url}:`, error);
    return false;
  }
}

// Check if a local file exists
function checkLocalFileExists(url) {
  if (!url || url.startsWith('http')) return false;
  
  // Handle local paths like /uploads/filename
  const filename = path.basename(url);
  const possiblePaths = [
    path.join(__dirname, '..', 'uploads', filename),
    path.join(__dirname, '..', '..', 'uploads', filename)
  ];
  
  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      return true;
    }
  }
  
  return false;
}

// Check if any file reference exists
async function checkFileExists(url) {
  if (!url) return true; // null/undefined is considered valid (no file)
  
  // Check S3 if it's an S3 URL
  if (url.includes('amazonaws.com') || (process.env.S3_CUSTOM_DOMAIN && url.includes(process.env.S3_CUSTOM_DOMAIN))) {
    return await checkFileExistsInS3(url);
  }
  
  // Check local file
  return checkLocalFileExists(url);
}

// Analyze a single card for broken file references
async function analyzeCard(card) {
  const issues = [];
  
  // Check all file fields
  const fileFields = ['preview', 'download', 'movie', 'transcript'];
  
  for (const field of fileFields) {
    if (card[field]) {
      const exists = await checkFileExists(card[field]);
      if (!exists) {
        issues.push({
          field,
          url: card[field],
          action: 'missing'
        });
      }
    }
  }
  
  // Check image sequence for social cards
  if (card.imageSequence && Array.isArray(card.imageSequence)) {
    for (let i = 0; i < card.imageSequence.length; i++) {
      const url = card.imageSequence[i];
      if (url) {
        const exists = await checkFileExists(url);
        if (!exists) {
          issues.push({
            field: `imageSequence[${i}]`,
            url: url,
            action: 'missing'
          });
        }
      }
    }
  }
  
  return issues;
}

// Fix issues for a card
async function fixCardIssues(card, issues) {
  if (issues.length === 0) return null;
  
  const updateData = {};
  const removedFiles = [];
  
  for (const issue of issues) {
    if (issue.field.startsWith('imageSequence[')) {
      // Handle image sequence separately
      if (!updateData.imageSequence) {
        updateData.imageSequence = [...card.imageSequence];
      }
      const index = parseInt(issue.field.match(/\[(\d+)\]/)[1]);
      updateData.imageSequence[index] = null;
      removedFiles.push(`${issue.field}: ${issue.url}`);
    } else {
      // Handle regular fields
      updateData[issue.field] = null;
      removedFiles.push(`${issue.field}: ${issue.url}`);
    }
  }
  
  // Clean up image sequence (remove null entries)
  if (updateData.imageSequence) {
    updateData.imageSequence = updateData.imageSequence.filter(url => url !== null);
    if (updateData.imageSequence.length === 0) {
      updateData.imageSequence = [];
    }
  }
  
  // Add a note to the description about the missing files
  const missingFileNote = `\n\n[System Note: The following files were missing and references were removed: ${removedFiles.join(', ')}]`;
  if (!card.description.includes('[System Note:')) {
    updateData.description = card.description + missingFileNote;
  }
  
  return updateData;
}

// Main function to fix broken file references
async function fixBrokenFileReferences() {
  try {
    await connectToDatabase();
    
    scriptLogger.info('Starting broken file reference analysis...');
    
    let query = {};
    if (SPECIFIC_CARD_ID) {
      query._id = SPECIFIC_CARD_ID;
      scriptLogger.info(`Analyzing specific card: ${SPECIFIC_CARD_ID}`);
    } else {
      scriptLogger.info('Analyzing all cards...');
    }
    
    const cards = await Card.find(query);
    scriptLogger.info(`Found ${cards.length} card(s) to analyze`);
    
    let totalIssues = 0;
    let cardsWithIssues = 0;
    let fixedCards = 0;
    
    for (const card of cards) {
      scriptLogger.info(`Analyzing card ${card._id}: "${card.description.substring(0, 50)}..."`);
      
      const issues = await analyzeCard(card);
      
      if (issues.length > 0) {
        cardsWithIssues++;
        totalIssues += issues.length;
        
        scriptLogger.warn(`Found ${issues.length} issue(s) in card ${card._id}:`);
        issues.forEach(issue => {
          scriptLogger.warn(`  - ${issue.field}: ${issue.url}`);
        });
        
        if (!DRY_RUN) {
          const updateData = await fixCardIssues(card, issues);
          if (updateData) {
            await Card.findByIdAndUpdate(card._id, updateData);
            scriptLogger.info(`✅ Fixed card ${card._id}`);
            fixedCards++;
          }
        } else {
          scriptLogger.info(`🔍 DRY RUN: Would fix card ${card._id}`);
        }
      } else {
        scriptLogger.info(`✅ Card ${card._id} has no broken file references`);
      }
    }
    
    // Summary
    scriptLogger.info('\n=== SUMMARY ===');
    scriptLogger.info(`Total cards analyzed: ${cards.length}`);
    scriptLogger.info(`Cards with issues: ${cardsWithIssues}`);
    scriptLogger.info(`Total broken references: ${totalIssues}`);
    
    if (!DRY_RUN) {
      scriptLogger.info(`Cards fixed: ${fixedCards}`);
    } else {
      scriptLogger.info(`Cards that would be fixed: ${cardsWithIssues}`);
      scriptLogger.info('\nTo apply fixes, run with DRY_RUN=false');
    }
    
  } catch (error) {
    scriptLogger.error('Error fixing broken file references:', error);
  } finally {
    await mongoose.connection.close();
    scriptLogger.info('Database connection closed');
  }
}

// Run the script
if (require.main === module) {
  scriptLogger.info('Starting broken file reference fix script...');
  scriptLogger.info(`DRY RUN: ${DRY_RUN ? 'ENABLED (no changes will be made)' : 'DISABLED (changes will be applied)'}`);
  
  fixBrokenFileReferences()
    .then(() => {
      scriptLogger.info('Script completed');
      process.exit(0);
    })
    .catch(error => {
      scriptLogger.error('Script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixBrokenFileReferences };