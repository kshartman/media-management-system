const { Card } = require('../models');
const { connectToDatabase } = require('../db/connection');
const logger = require('./logger');

// Create child logger for migration
const migrationLogger = logger.child({ component: 'migration' });

/**
 * Migrates S3 URLs from global format to regional format
 * Changes: https://zivepublic.s3.amazonaws.com/...
 * To: https://zivepublic.s3.us-east-1.amazonaws.com/...
 */
async function migrateS3Urls() {
  try {
    migrationLogger.info('Starting S3 URL migration...');
    
    // Connect to database
    await connectToDatabase();
    
    // Get all cards
    const cards = await Card.find({});
    migrationLogger.info(`Found ${cards.length} cards to check`);
    
    let updatedCount = 0;
    const batchSize = 100;
    
    // Process cards in batches
    for (let i = 0; i < cards.length; i += batchSize) {
      const batch = cards.slice(i, i + batchSize);
      const bulkOps = [];
      
      for (const card of batch) {
        const updateFields = {};
        let hasUpdates = false;
        
        // Check and update preview URL
        if (card.preview && needsUrlUpdate(card.preview)) {
          updateFields.preview = updateUrl(card.preview);
          hasUpdates = true;
        }
        
        // Check and update download URL
        if (card.download && needsUrlUpdate(card.download)) {
          updateFields.download = updateUrl(card.download);
          hasUpdates = true;
        }
        
        // Check and update movie URL
        if (card.movie && needsUrlUpdate(card.movie)) {
          updateFields.movie = updateUrl(card.movie);
          hasUpdates = true;
        }
        
        // Check and update transcript URL
        if (card.transcript && needsUrlUpdate(card.transcript)) {
          updateFields.transcript = updateUrl(card.transcript);
          hasUpdates = true;
        }
        
        // Check and update imageSequence URLs
        if (card.imageSequence && Array.isArray(card.imageSequence)) {
          const updatedImageSequence = card.imageSequence.map(url => {
            return needsUrlUpdate(url) ? updateUrl(url) : url;
          });
          
          // Check if any URLs were updated
          if (updatedImageSequence.some((url, index) => url !== card.imageSequence[index])) {
            updateFields.imageSequence = updatedImageSequence;
            hasUpdates = true;
          }
        }
        
        // Add to bulk operations if there are updates
        if (hasUpdates) {
          bulkOps.push({
            updateOne: {
              filter: { _id: card._id },
              update: { $set: updateFields }
            }
          });
          updatedCount++;
          
          migrationLogger.debug(`Card ${card._id}: ${Object.keys(updateFields).join(', ')} updated`);
        }
      }
      
      // Execute bulk operations for this batch
      if (bulkOps.length > 0) {
        await Card.bulkWrite(bulkOps);
        migrationLogger.info(`Processed batch ${Math.floor(i / batchSize) + 1}: ${bulkOps.length} cards updated`);
      }
    }
    
    migrationLogger.info(`Migration completed! Updated ${updatedCount} cards`);
    
    // Verify migration
    await verifyMigration();
    
    return { success: true, updatedCount };
    
  } catch (error) {
    migrationLogger.error('Migration failed:', error);
    throw error;
  }
}

/**
 * Checks if a URL needs to be updated from global to regional format
 */
function needsUrlUpdate(url) {
  if (!url || typeof url !== 'string') return false;
  
  // Check if it's the old global format that needs updating
  return url.includes('zivepublic.s3.amazonaws.com') && 
         !url.includes('zivepublic.s3.us-east-1.amazonaws.com');
}

/**
 * Updates a URL from global format to regional format
 */
function updateUrl(url) {
  if (!url || typeof url !== 'string') return url;
  
  // Replace global S3 domain with regional domain
  return url.replace(
    'zivepublic.s3.amazonaws.com',
    'zivepublic.s3.us-east-1.amazonaws.com'
  );
}

/**
 * Verifies that migration was successful by checking for remaining old URLs
 */
async function verifyMigration() {
  try {
    migrationLogger.info('Verifying migration...');
    
    // Search for any remaining old format URLs
    const cardsWithOldUrls = await Card.find({
      $or: [
        { preview: { $regex: /zivepublic\.s3\.amazonaws\.com/, $not: /us-east-1/ } },
        { download: { $regex: /zivepublic\.s3\.amazonaws\.com/, $not: /us-east-1/ } },
        { movie: { $regex: /zivepublic\.s3\.amazonaws\.com/, $not: /us-east-1/ } },
        { transcript: { $regex: /zivepublic\.s3\.amazonaws\.com/, $not: /us-east-1/ } },
        { imageSequence: { $elemMatch: { $regex: /zivepublic\.s3\.amazonaws\.com/, $not: /us-east-1/ } } }
      ]
    });
    
    if (cardsWithOldUrls.length === 0) {
      migrationLogger.info('✅ Migration verification passed - no old URLs found');
    } else {
      migrationLogger.warn(`⚠️ Found ${cardsWithOldUrls.length} cards with old URLs still remaining:`);
      cardsWithOldUrls.forEach(card => {
        migrationLogger.warn(`Card ${card._id}: ${card.type} - ${card.description.substring(0, 50)}...`);
      });
    }
    
    // Count total URLs that were successfully migrated
    const cardsWithNewUrls = await Card.find({
      $or: [
        { preview: { $regex: /zivepublic\.s3\.us-east-1\.amazonaws\.com/ } },
        { download: { $regex: /zivepublic\.s3\.us-east-1\.amazonaws\.com/ } },
        { movie: { $regex: /zivepublic\.s3\.us-east-1\.amazonaws\.com/ } },
        { transcript: { $regex: /zivepublic\.s3\.us-east-1\.amazonaws\.com/ } },
        { imageSequence: { $elemMatch: { $regex: /zivepublic\.s3\.us-east-1\.amazonaws\.com/ } } }
      ]
    });
    
    migrationLogger.info(`✅ Found ${cardsWithNewUrls.length} cards with regional URLs`);
    
  } catch (error) {
    migrationLogger.error('Migration verification failed:', error);
    throw error;
  }
}

/**
 * Dry run - shows what would be updated without making changes
 */
async function dryRunMigration() {
  try {
    migrationLogger.info('Starting S3 URL migration dry run...');
    
    // Connect to database
    await connectToDatabase();
    
    // Get all cards
    const cards = await Card.find({});
    migrationLogger.info(`Found ${cards.length} cards to check`);
    
    let wouldUpdateCount = 0;
    const updateSummary = {
      preview: 0,
      download: 0,
      movie: 0,
      transcript: 0,
      imageSequence: 0
    };
    
    for (const card of cards) {
      const fieldsToUpdate = [];
      
      // Check each field
      if (card.preview && needsUrlUpdate(card.preview)) {
        fieldsToUpdate.push('preview');
        updateSummary.preview++;
      }
      
      if (card.download && needsUrlUpdate(card.download)) {
        fieldsToUpdate.push('download');
        updateSummary.download++;
      }
      
      if (card.movie && needsUrlUpdate(card.movie)) {
        fieldsToUpdate.push('movie');
        updateSummary.movie++;
      }
      
      if (card.transcript && needsUrlUpdate(card.transcript)) {
        fieldsToUpdate.push('transcript');
        updateSummary.transcript++;
      }
      
      if (card.imageSequence && Array.isArray(card.imageSequence)) {
        const hasOldUrls = card.imageSequence.some(url => needsUrlUpdate(url));
        if (hasOldUrls) {
          fieldsToUpdate.push('imageSequence');
          updateSummary.imageSequence++;
        }
      }
      
      if (fieldsToUpdate.length > 0) {
        wouldUpdateCount++;
        migrationLogger.info(`Would update card ${card._id} (${card.type}): ${fieldsToUpdate.join(', ')}`);
      }
    }
    
    migrationLogger.info('\n📊 Dry run summary:');
    migrationLogger.info(`Total cards that would be updated: ${wouldUpdateCount}`);
    migrationLogger.info(`Fields that would be updated:`);
    Object.entries(updateSummary).forEach(([field, count]) => {
      if (count > 0) {
        migrationLogger.info(`  - ${field}: ${count} cards`);
      }
    });
    
    return { success: true, wouldUpdateCount, updateSummary };
    
  } catch (error) {
    migrationLogger.error('Dry run failed:', error);
    throw error;
  }
}

module.exports = {
  migrateS3Urls,
  dryRunMigration,
  verifyMigration
};