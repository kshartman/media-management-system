/**
 * Fix Image Dimensions Script
 * 
 * This script fetches all image cards from the database, downloads each image,
 * extracts the accurate dimensions, and updates the database with the correct values.
 * 
 * Usage: node fix-image-dimensions.js [--dry-run]
 * 
 * Options:
 *   --dry-run     Show what would be updated without making changes
 */

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { connectToDatabase } = require('../db/connection');
const { Card } = require('../models');
const { isS3Configured } = require('../utils/s3Storage');
const os = require('os');
const sharp = require('sharp');

// Import image-size properly
console.log('Importing image-size module...');
let imageSize;
try {
  const sizeOf = require('image-size');
  console.log('image-size module type:', typeof sizeOf);
  console.log('image-size module contents:', Object.keys(sizeOf));

  // Check if it's a function or an object with imageSize function
  if (sizeOf && typeof sizeOf.imageSize === 'function') {
    console.log('Using sizeOf.imageSize function');
    imageSize = sizeOf.imageSize;
  } else if (typeof sizeOf === 'function') {
    console.log('Using sizeOf function directly');
    imageSize = sizeOf;
  } else {
    console.error('Could not find appropriate function in image-size module');
    imageSize = null;
  }
} catch (error) {
  console.error('Failed to import image-size:', error);
  imageSize = null;
}

// Temp directory for downloaded images
const TEMP_DIR = path.join(os.tmpdir(), 'image-dimension-fix');

// Parse command line arguments
const DRY_RUN = process.argv.includes('--dry-run');

if (DRY_RUN) {
  console.log('🔍 Running in DRY RUN mode - no changes will be made');
}

/**
 * Downloads a file from a URL to a local destination
 * @param {string} url - URL to download
 * @param {string} destPath - Local destination path
 * @returns {Promise<string>} - Path to the downloaded file
 */
const downloadFile = (url, destPath) => {
  return new Promise((resolve, reject) => {
    // Create directory if it doesn't exist
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Remove any previous temporary file
    if (fs.existsSync(destPath)) {
      fs.unlinkSync(destPath);
    }

    console.log(`Downloading file from ${url}`);
    const file = fs.createWriteStream(destPath);
    
    // Choose the right protocol
    const protocol = url.startsWith('https') ? https : http;
    
    const request = protocol.get(url, response => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download file: HTTP status code ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`Download complete: ${destPath} (${fs.statSync(destPath).size} bytes)`);
        resolve(destPath);
      });
    });
    
    request.on('error', err => {
      fs.unlink(destPath, () => {});
      console.error(`Error downloading file: ${err.message}`);
      reject(err);
    });
    
    file.on('error', err => {
      fs.unlink(destPath, () => {});
      console.error(`Error saving file: ${err.message}`);
      reject(err);
    });

    // Handle timeouts
    request.setTimeout(30000, () => {
      request.abort();
      fs.unlink(destPath, () => {});
      reject(new Error('Download timed out'));
    });
  });
};

/**
 * Extracts dimensions from an image file
 * @param {string} imagePath - Local path to the image file
 * @returns {Promise<{width: number, height: number} | null>} - Image dimensions or null if extraction fails
 */
const extractImageDimensions = async (imagePath) => {
  try {
    if (!fs.existsSync(imagePath)) {
      console.error(`File not found: ${imagePath}`);
      return null;
    }

    const stats = fs.statSync(imagePath);
    if (stats.size === 0) {
      console.error(`File is empty: ${imagePath}`);
      return null;
    }

    // Try image-size first
    if (imageSize) {
      try {
        // Read file as buffer
        const buffer = fs.readFileSync(imagePath);
        const dimensions = imageSize(buffer);
        
        if (dimensions && dimensions.width && dimensions.height) {
          console.log(`Extracted dimensions using image-size: ${dimensions.width}×${dimensions.height}`);
          return {
            width: dimensions.width,
            height: dimensions.height
          };
        }
      } catch (sizeError) {
        console.error(`Error with image-size: ${sizeError.message}`);
        // Continue to sharp fallback
      }
    }
    
    // Fallback to using sharp
    try {
      console.log(`Trying sharp for ${path.basename(imagePath)}`);
      const metadata = await sharp(imagePath).metadata();
      
      if (metadata && metadata.width && metadata.height) {
        console.log(`Extracted dimensions using sharp: ${metadata.width}×${metadata.height}`);
        return {
          width: metadata.width,
          height: metadata.height
        };
      }
      
      console.error(`Could not extract dimensions from ${path.basename(imagePath)}`);
      return null;
    } catch (sharpError) {
      console.error(`Error with sharp: ${sharpError.message}`);
      return null;
    }
  } catch (error) {
    console.error(`Error extracting dimensions from ${path.basename(imagePath)}: ${error.message}`);
    return null;
  }
};

/**
 * Main function to find and fix image dimensions
 */
async function fixImageDimensions() {
  try {
    console.log('Connecting to database...');
    await connectToDatabase();
    
    // Find all image-type cards
    console.log('Fetching all image cards...');
    const imageCards = await Card.find({ type: 'image' });
    console.log(`Found ${imageCards.length} image cards`);
    
    // Create temporary directory
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
      console.log(`Created temp directory: ${TEMP_DIR}`);
    }
    
    // Process each image card
    let updatedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    for (let i = 0; i < imageCards.length; i++) {
      const card = imageCards[i];
      console.log(`\nProcessing card ${i+1}/${imageCards.length}: ${card._id}`);
      
      // Get the image path (prefer download over preview)
      const imagePath = card.download || card.preview;
      
      if (!imagePath) {
        console.log(`No image path found for card ${card._id}, skipping`);
        skippedCount++;
        continue;
      }
      
      try {
        // Generate a temp filename based on the original
        const filename = path.basename(imagePath).split('?')[0]; // Remove query params
        const tempFilePath = path.join(TEMP_DIR, `${i}_${filename}`);
        
        // Download the image
        await downloadFile(imagePath, tempFilePath);
        
        // Extract dimensions
        const dimensions = await extractImageDimensions(tempFilePath);
        
        // Initialize fileMetadata if it doesn't exist
        if (!card.fileMetadata) {
          card.fileMetadata = {
            date: card.createdAt || new Date()
          };
        }
        
        const currentWidth = card.fileMetadata.width;
        const currentHeight = card.fileMetadata.height;
        
        if (dimensions) {
          // Only update if dimensions are different
          const needsUpdate = 
            currentWidth !== dimensions.width || 
            currentHeight !== dimensions.height;
          
          if (needsUpdate) {
            console.log(`Dimensions changed for ${card._id}:`);
            console.log(`  Old: ${currentWidth || 'null'} × ${currentHeight || 'null'}`);
            console.log(`  New: ${dimensions.width} × ${dimensions.height}`);
            
            if (!DRY_RUN) {
              // Update the dimensions
              card.fileMetadata.width = dimensions.width;
              card.fileMetadata.height = dimensions.height;
              
              // Save the updated card
              await card.save();
              console.log(`  ✅ Updated card ${card._id}`);
              updatedCount++;
            } else {
              console.log(`  🔍 Would update card ${card._id} (dry run)`);
              updatedCount++;
            }
          } else {
            console.log(`Dimensions unchanged for ${card._id}: ${currentWidth} × ${currentHeight}`);
            skippedCount++;
          }
        } else {
          console.log(`Failed to extract dimensions for card ${card._id}`);
          errorCount++;
        }
        
        // Clean up the temp file
        try {
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
        } catch (cleanupError) {
          console.error(`Error cleaning up temp file: ${cleanupError.message}`);
        }
      } catch (error) {
        console.error(`Error processing card ${card._id}: ${error.message}`);
        errorCount++;
      }
    }
    
    console.log('\n==========================================');
    console.log('Dimensions fix completed:');
    console.log(`  Total image cards: ${imageCards.length}`);
    if (DRY_RUN) {
      console.log(`  Would update: ${updatedCount}`);
    } else {
      console.log(`  Updated: ${updatedCount}`);
    }
    console.log(`  Skipped (no change needed): ${skippedCount}`);
    console.log(`  Errors: ${errorCount}`);
    console.log('==========================================');
    
    // Clean up temp directory if it's empty
    try {
      const files = fs.readdirSync(TEMP_DIR);
      if (files.length === 0) {
        fs.rmdirSync(TEMP_DIR);
        console.log(`Removed empty temp directory: ${TEMP_DIR}`);
      } else {
        console.log(`Temp directory not empty, not removing: ${TEMP_DIR}`);
        console.log(`Files remaining: ${files.length}`);
      }
    } catch (cleanupError) {
      console.error(`Error cleaning up temp directory: ${cleanupError.message}`);
    }
  } catch (error) {
    console.error('Error in fixImageDimensions:', error);
  } finally {
    // Close the database connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the script
console.log('Starting image dimensions fix...');
fixImageDimensions()
  .then(() => {
    console.log('Image dimensions fix script completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error in fix script:', error);
    process.exit(1);
  });