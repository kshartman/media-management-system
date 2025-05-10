const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { connectToDatabase } = require('./db/connection');
const { Card } = require('./models');

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

// Extract metadata from files
async function extractFileMetadata(filePath, providedDate = null) {
  try {
    const fullPath = path.join(__dirname, filePath);
    console.log(`  Processing file: ${fullPath}`);

    // Check if the file exists
    if (!fs.existsSync(fullPath)) {
      console.log(`  File not found: ${fullPath}`);
      return {
        date: providedDate || new Date(),
        width: null,
        height: null,
        fileSize: null
      };
    }
    
    const stats = fs.statSync(fullPath);
    const fileSize = stats.size; // File size in bytes
    const date = providedDate || new Date();
    
    // Extract dimensions for image and video files
    let width = null;
    let height = null;
    
    const extension = path.extname(filePath).toLowerCase();
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    
    if (imageExtensions.includes(extension)) {
      try {
        if (typeof imageSize === 'function') {
          console.log(`  Extracting dimensions from image: ${path.basename(fullPath)}`);
          // Read file buffer first
          const buffer = fs.readFileSync(fullPath);
          const dimensions = imageSize(buffer);
          width = dimensions.width;
          height = dimensions.height;
          console.log(`  Extracted dimensions: ${width}×${height}`);
        } else {
          console.log(`  Can't extract dimensions: imageSize is not a function`);

          // Fallback: estimate dimensions based on filename patterns
          if (fullPath.includes('sample-image')) {
            width = 1920;
            height = 1080;
            console.log(`  Using fallback dimensions for sample image: ${width}×${height}`);
          } else if (fullPath.includes('sample-reel')) {
            width = 1280;
            height = 720;
            console.log(`  Using fallback dimensions for sample reel: ${width}×${height}`);
          } else if (fullPath.includes('ZIVE-logo')) {
            width = 800;
            height = 600;
            console.log(`  Using fallback dimensions for logo: ${width}×${height}`);
          }
        }
      } catch (err) {
        console.error(`  Error getting image dimensions:`, err.message);
      }
    }

    return {
      date,
      width,
      height,
      fileSize
    };
  } catch (error) {
    console.error('Error extracting file metadata:', error.message);
    return {
      date: providedDate || new Date(),
      width: null,
      height: null,
      fileSize: null
    };
  }
}

// Main function to update card metadata
async function updateCardMetadata() {
  try {
    console.log('Connecting to database...');
    await connectToDatabase();
    
    console.log('Fetching all cards...');
    const cards = await Card.find({});
    console.log(`Found ${cards.length} cards to process`);
    
    let updatedCount = 0;

    for (const card of cards) {
      try {
        console.log(`\nProcessing card: ${card._id} (${card.type})`);
        
        // Initialize fileMetadata if it doesn't exist
        if (!card.fileMetadata) {
          card.fileMetadata = {
            date: card.date || new Date(),
            width: null,
            height: null,
            fileSize: null
          };
        }

        // Extract metadata based on card type
        let mainMetadata = null;
        
        if (card.type === 'image') {
          console.log(`  Card is an image type`);
          if (card.download) {
            console.log(`  Extracting metadata from download file: ${card.download}`);
            mainMetadata = await extractFileMetadata(card.download, card.fileMetadata.date);
          }
        } else if (card.type === 'social') {
          console.log(`  Card is a social type`);
          if (card.documentCopy) {
            console.log(`  Extracting metadata from document: ${card.documentCopy}`);
            mainMetadata = await extractFileMetadata(card.documentCopy, card.fileMetadata.date);
          }
        } else if (card.type === 'reel') {
          console.log(`  Card is a reel type`);
          if (card.movie) {
            console.log(`  Extracting metadata from video: ${card.movie}`);
            mainMetadata = await extractFileMetadata(card.movie, card.fileMetadata.date);
          }
        }
        
        // Extract preview metadata if main file didn't provide dimensions
        let previewMetadata = null;
        if (
          card.preview && 
          (!mainMetadata || (!mainMetadata.width && !mainMetadata.height))
        ) {
          console.log(`  Extracting metadata from preview: ${card.preview}`);
          previewMetadata = await extractFileMetadata(card.preview, card.fileMetadata.date);
        }
        
        // Update the card's metadata
        if (mainMetadata) {
          card.fileMetadata.date = mainMetadata.date;
          card.fileMetadata.fileSize = mainMetadata.fileSize;
          
          if (mainMetadata.width && mainMetadata.height) {
            card.fileMetadata.width = mainMetadata.width;
            card.fileMetadata.height = mainMetadata.height;
          }
        }
        
        // Use preview dimensions if main file didn't have any
        if (
          previewMetadata && 
          previewMetadata.width && 
          previewMetadata.height && 
          (!card.fileMetadata.width || !card.fileMetadata.height)
        ) {
          card.fileMetadata.width = previewMetadata.width;
          card.fileMetadata.height = previewMetadata.height;
        }
        
        // Save the updated card
        await card.save();
        updatedCount++;
        console.log(`  ✓ Updated metadata for card ${card._id}`);
      } catch (error) {
        console.error(`  ✗ Error updating card ${card._id}:`, error.message);
      }
    }
    
    console.log(`\nSuccessfully updated metadata for ${updatedCount} out of ${cards.length} cards`);
  } catch (error) {
    console.error('Error in updateCardMetadata:', error.message);
  } finally {
    // Close the database connection
    console.log('Closing database connection...');
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the update script
console.log('Starting metadata update process...');
updateCardMetadata()
  .then(() => {
    console.log('Metadata update process completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error in metadata update process:', error.message);
    process.exit(1);
  });