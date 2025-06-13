#!/usr/bin/env node

/**
 * Fix the specific card issue with missing video file
 * 
 * Card ID: 684a7b233e99c1f8036dadca
 * Issue: References a video file that doesn't exist
 * Solution: Remove the broken reference and add a note
 */

const mongoose = require('mongoose');
const { Card } = require('../models');
const logger = require('../utils/logger');
require('dotenv').config();

const scriptLogger = logger.child({ module: 'fix-specific-card' });

const CARD_ID = '684a7b233e99c1f8036dadca';
const DRY_RUN = false; // Set to true to see what would happen without making changes

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

async function fixSpecificCard() {
  try {
    await connectToDatabase();
    
    scriptLogger.info(`Fixing card ${CARD_ID}...`);
    
    // Find the card
    const card = await Card.findById(CARD_ID);
    if (!card) {
      scriptLogger.error(`Card ${CARD_ID} not found`);
      return;
    }
    
    scriptLogger.info(`Found card: "${card.description}"`);
    scriptLogger.info(`Current movie path: ${card.movie}`);
    
    // Prepare the fix
    const missingFile = card.movie;
    const updateData = {
      movie: null
    };
    
    // Add a note to the description if it doesn't already exist
    const noteText = `\n\n[System Note: Video file was missing and reference was removed. Original file: ${missingFile}. Upload date: ${card.createdAt.toDateString()}]`;
    
    if (!card.description.includes('[System Note:')) {
      updateData.description = card.description + noteText;
    }
    
    if (DRY_RUN) {
      scriptLogger.info('DRY RUN - Would make the following changes:');
      scriptLogger.info(`  - Set movie field to null`);
      scriptLogger.info(`  - Add note to description: ${noteText}`);
    } else {
      // Apply the fix
      await Card.findByIdAndUpdate(CARD_ID, updateData);
      scriptLogger.info('✅ Successfully fixed the card:');
      scriptLogger.info(`  - Removed broken movie reference: ${missingFile}`);
      scriptLogger.info(`  - Added explanatory note to description`);
      
      // Verify the fix
      const updatedCard = await Card.findById(CARD_ID);
      scriptLogger.info(`Verification - movie field is now: ${updatedCard.movie}`);
      scriptLogger.info(`Verification - description now includes note: ${updatedCard.description.includes('[System Note:')}`);
    }
    
  } catch (error) {
    scriptLogger.error('Error fixing card:', error);
  } finally {
    await mongoose.connection.close();
    scriptLogger.info('Database connection closed');
  }
}

// Run the script
if (require.main === module) {
  scriptLogger.info(`Starting fix for card ${CARD_ID}...`);
  scriptLogger.info(`DRY RUN: ${DRY_RUN ? 'ENABLED (no changes will be made)' : 'DISABLED (changes will be applied)'}`);
  
  fixSpecificCard()
    .then(() => {
      scriptLogger.info('Fix completed');
      process.exit(0);
    })
    .catch(error => {
      scriptLogger.error('Fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixSpecificCard };