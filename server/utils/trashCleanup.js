const { Card } = require('../models');
const { deleteFile, isFileOrphaned } = require('./s3Storage');
const logger = require('./logger');

// Create a child logger for trash cleanup
const trashLogger = logger.child({ component: 'trash-cleanup' });

/**
 * Automatically clean up deleted cards that have exceeded the retention period
 * @param {number} retentionDays - Number of days to keep deleted cards (default: 30)
 */
async function cleanupExpiredTrashCards(retentionDays = 30) {
  try {
    trashLogger.info(`Starting trash cleanup for cards older than ${retentionDays} days`);
    
    // Calculate the cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    // Find cards that were deleted before the cutoff date
    const expiredCards = await Card.find({
      deletedAt: { $lt: cutoffDate }
    });
    
    if (expiredCards.length === 0) {
      trashLogger.info('No expired cards found for cleanup');
      return 0;
    }
    
    trashLogger.info(`Found ${expiredCards.length} expired cards to permanently delete`);
    
    let deletedCount = 0;
    let fileDeleteCount = 0;
    
    for (const card of expiredCards) {
      try {
        trashLogger.info(`Permanently deleting expired card: ${card._id} (deleted on ${card.deletedAt})`);
        
        // Collect all files associated with this card
        const filesToDelete = [];
        if (card.preview) filesToDelete.push(card.preview);
        if (card.download) filesToDelete.push(card.download);
        if (card.movie) filesToDelete.push(card.movie);
        if (card.transcript) filesToDelete.push(card.transcript);
        if (card.instagramCopy) filesToDelete.push(card.instagramCopy);
        if (card.facebookCopy) filesToDelete.push(card.facebookCopy);
        if (card.imageSequence && Array.isArray(card.imageSequence)) {
          filesToDelete.push(...card.imageSequence);
        }
        
        // Delete orphaned files
        for (const filePath of filesToDelete) {
          try {
            const isOrphaned = await isFileOrphaned(filePath, Card);
            if (isOrphaned) {
              await deleteFile(filePath);
              trashLogger.info(`Deleted orphaned file: ${filePath}`);
              fileDeleteCount++;
            } else {
              trashLogger.info(`File still referenced by other cards: ${filePath}`);
            }
          } catch (error) {
            trashLogger.error(`Error deleting file ${filePath}:`, error);
          }
        }
        
        // Permanently delete the card from database
        await Card.findByIdAndDelete(card._id);
        deletedCount++;
        
      } catch (error) {
        trashLogger.error(`Error deleting expired card ${card._id}:`, error);
      }
    }
    
    trashLogger.info(`Trash cleanup completed: ${deletedCount} cards and ${fileDeleteCount} files permanently deleted`);
    return deletedCount;
    
  } catch (error) {
    trashLogger.error('Error during trash cleanup:', error);
    throw error;
  }
}

/**
 * Start the automatic trash cleanup scheduler
 * @param {number} retentionDays - Number of days to keep deleted cards
 * @param {number} checkIntervalHours - How often to check for expired cards (default: 24 hours)
 */
function startTrashCleanupScheduler(retentionDays = 30, checkIntervalHours = 24) {
  trashLogger.info(`Starting trash cleanup scheduler: retention=${retentionDays} days, check interval=${checkIntervalHours} hours`);
  
  // Run initial cleanup
  cleanupExpiredTrashCards(retentionDays).catch(error => {
    trashLogger.error('Error in initial trash cleanup:', error);
  });
  
  // Schedule regular cleanup
  const intervalMs = checkIntervalHours * 60 * 60 * 1000; // Convert hours to milliseconds
  setInterval(async () => {
    try {
      await cleanupExpiredTrashCards(retentionDays);
    } catch (error) {
      trashLogger.error('Error in scheduled trash cleanup:', error);
    }
  }, intervalMs);
  
  trashLogger.info(`Trash cleanup scheduler started - will run every ${checkIntervalHours} hours`);
}

module.exports = {
  cleanupExpiredTrashCards,
  startTrashCleanupScheduler
};