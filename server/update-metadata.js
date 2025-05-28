const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { connectToDatabase } = require('./db/connection');
const { Card } = require('./models');
const { isS3Configured } = require('./utils/s3Storage');

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

// Function to guess dimensions from filename or common types
function guessDimensionsFromUrl(url) {
  const filename = url.split('/').pop().toLowerCase();
  
  // Try to extract dimensions from filename patterns like 800x600, 1920x1080, etc.
  const dimensionsMatch = filename.match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (dimensionsMatch) {
    return {
      width: parseInt(dimensionsMatch[1], 10),
      height: parseInt(dimensionsMatch[2], 10)
    };
  }
  
  // Assign default dimensions based on file patterns
  if (filename.includes('logo')) {
    return { width: 800, height: 600 };
  } else if (filename.includes('icon')) {
    return { width: 512, height: 512 };
  } else if (filename.includes('banner') || filename.includes('header')) {
    return { width: 1200, height: 300 };
  } else if (filename.includes('profile') || filename.includes('avatar')) {
    return { width: 400, height: 400 };
  } else if (filename.endsWith('.png') || filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
    // Default dimensions for standard images
    return { width: 1920, height: 1080 };
  }
  
  // Couldn't determine dimensions
  return { width: null, height: null };
}

// Check if URL is an S3 URL
function isS3Url(url) {
  return url && (
    url.includes('amazonaws.com') || 
    url.includes('zivepublic.s3') || 
    url.startsWith('https://s3.')
  );
}

// Extract metadata from files
async function extractFileMetadata(filePath, providedDate = null) {
  try {
    // Handle S3 URLs directly
    if (isS3Url(filePath)) {
      console.log(`  Processing S3 file: ${filePath}`);
      
      // Try to guess dimensions from the URL/filename
      const guessedDimensions = guessDimensionsFromUrl(filePath);
      console.log(`  Guessed dimensions from URL: ${guessedDimensions.width}×${guessedDimensions.height}`);
      
      // For S3 files, set a default size since we can't determine it without downloading
      const defaultFileSize = 1024 * 1024; // 1MB as a reasonable default
      
      return {
        date: providedDate || new Date(),
        width: guessedDimensions.width,
        height: guessedDimensions.height,
        fileSize: defaultFileSize
      };
    }
    
    // Handle local files
    const fullPath = path.join(__dirname, filePath);
    console.log(`  Processing local file: ${fullPath}`);

    // Check if the file exists
    if (!fs.existsSync(fullPath)) {
      console.log(`  File not found: ${fullPath}`);
      
      // Try to guess dimensions from the filename
      const guessedDimensions = guessDimensionsFromUrl(filePath);
      console.log(`  Guessed dimensions from filename: ${guessedDimensions.width}×${guessedDimensions.height}`);
      
      return {
        date: providedDate || new Date(),
        width: guessedDimensions.width,
        height: guessedDimensions.height,
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
          const guessedDimensions = guessDimensionsFromUrl(filePath);
          width = guessedDimensions.width;
          height = guessedDimensions.height;
          console.log(`  Using fallback dimensions: ${width}×${height}`);
        }
      } catch (err) {
        console.error(`  Error getting image dimensions:`, err.message);
        
        // Fall back to guessed dimensions
        const guessedDimensions = guessDimensionsFromUrl(filePath);
        width = guessedDimensions.width;
        height = guessedDimensions.height;
        console.log(`  Using fallback dimensions after error: ${width}×${height}`);
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
    
    // Last resort: provide default values
    return {
      date: providedDate || new Date(),
      width: 1920, // Default width for images
      height: 1080, // Default height for images
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