#!/usr/bin/env node

/**
 * Migration script to update S3 URLs from global to regional format
 * Usage:
 *   node scripts/migrate-s3-urls.js --dry-run    # Preview changes
 *   node scripts/migrate-s3-urls.js --migrate    # Apply changes
 *   node scripts/migrate-s3-urls.js --verify     # Verify migration
 */

const { migrateS3Urls, dryRunMigration, verifyMigration } = require('../utils/migrateS3Urls');
const logger = require('../utils/logger');

// Create script logger
const scriptLogger = logger.child({ component: 'migration-script' });

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
S3 URL Migration Script

This script updates S3 URLs in the database from global format to regional format:
  From: https://zivepublic.s3.amazonaws.com/...
  To:   https://zivepublic.s3.us-east-1.amazonaws.com/...

Usage:
  node scripts/migrate-s3-urls.js --dry-run    # Preview what would be changed
  node scripts/migrate-s3-urls.js --migrate    # Apply the migration
  node scripts/migrate-s3-urls.js --verify     # Verify migration was successful

Options:
  --dry-run     Show what would be updated without making changes
  --migrate     Apply the migration to update URLs
  --verify      Check if migration was successful
  --help, -h    Show this help message
`);
    process.exit(0);
  }
  
  try {
    if (args.includes('--dry-run')) {
      scriptLogger.info('🔍 Running dry run migration...');
      const result = await dryRunMigration();
      scriptLogger.info('✅ Dry run completed successfully');
      
      if (result.wouldUpdateCount === 0) {
        scriptLogger.info('🎉 No URLs need updating - all are already in regional format!');
      } else {
        scriptLogger.info(`\n🚀 Ready to migrate! Run with --migrate to update ${result.wouldUpdateCount} cards`);
      }
      
    } else if (args.includes('--migrate')) {
      scriptLogger.info('🚀 Starting S3 URL migration...');
      
      // Confirm before proceeding
      console.log('\n⚠️  This will update URLs in your database. Make sure you have a backup!');
      console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const result = await migrateS3Urls();
      scriptLogger.info('✅ Migration completed successfully');
      scriptLogger.info(`📊 Updated ${result.updatedCount} cards`);
      
    } else if (args.includes('--verify')) {
      scriptLogger.info('🔍 Verifying migration...');
      await verifyMigration();
      scriptLogger.info('✅ Verification completed');
      
    } else {
      scriptLogger.error('❌ No valid option provided');
      console.log('Use --help to see available options');
      process.exit(1);
    }
    
  } catch (error) {
    scriptLogger.error('❌ Script failed:', error);
    process.exit(1);
  }
  
  // Exit cleanly
  process.exit(0);
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  scriptLogger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  scriptLogger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run the script
main();