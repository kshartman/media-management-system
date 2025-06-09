/**
 * Helper module for processing image sequences for social cards
 */
const path = require('path');
const fs = require('fs');
const { uploadLocalFileToS3, isS3Configured } = require('./utils/s3Storage');

/**
 * Process all images in a sequence and return paths and metadata
 * @param {object} req - Express request object
 * @param {object} files - Multer files object
 * @param {Date} date - Date to associate with the images
 * @param {function} extractMetadata - Function to extract metadata from files
 * @param {object} existingCardData - Optional existing card data when updating
 * @returns {Promise<object>} - Object with paths and metadata
 */
async function processImageSequence(req, files, date, extractMetadata, existingCardData = null) {
  // Get the sequence count from the request body
  const sequenceCount = parseInt(req.body.imageSequenceCount || '0', 10);
  
  // Check for existing image sequence when updating a card
  const hasExistingSequence = req.body.existingImageSequence && 
    req.method === 'PUT' && 
    existingCardData && 
    existingCardData.imageSequence;
  
  // Parse existing image sequence from request if available
  let existingImageSequence = [];
  let existingOriginalFileNames = [];
  let existingFileSizes = [];
  let existingTotalSize = 0;
  
  if (hasExistingSequence) {
    try {
      // Parse the existingImageSequence JSON string
      existingImageSequence = JSON.parse(req.body.existingImageSequence);
      console.log(`Found ${existingImageSequence.length} existing images in sequence`);
      
      // Get existing metadata if available
      if (existingCardData.fileMetadata) {
        existingOriginalFileNames = existingCardData.fileMetadata.imageSequenceOriginalFileNames || [];
        existingFileSizes = existingCardData.fileMetadata.imageSequenceFileSizes || [];
        existingTotalSize = existingCardData.fileMetadata.totalSequenceSize || 0;
      }
    } catch (error) {
      console.error('Error parsing existingImageSequence:', error);
      // Default to empty arrays if parsing fails
      existingImageSequence = [];
      existingOriginalFileNames = [];
      existingFileSizes = [];
      existingTotalSize = 0;
    }
  }
  
  // If no new files and no existing files, return empty arrays
  if (sequenceCount <= 0 && existingImageSequence.length === 0) {
    console.log('No image sequence files detected');
    return {
      imageSequence: [],
      imageSequenceOriginalFileNames: [],
      imageSequenceFileSizes: [],
      totalSequenceSize: 0,
      imageSequenceCount: 0
    };
  }
  
  console.log(`Processing ${sequenceCount} new image sequence files (plus ${existingImageSequence.length} existing files)`);
  const sequencePaths = [...existingImageSequence]; // Start with existing images
  const originalFileNames = [...existingOriginalFileNames];
  const fileSizes = [...existingFileSizes];
  let totalSize = existingTotalSize;
  
  // Initialize dimensions variables outside the loop
  let width = null;
  let height = null;
  
  // Process each new image in the sequence
  for (let i = 0; i < sequenceCount; i++) {
    const fieldName = `imageSequence_${i}`;
    console.log(`Looking for field: ${fieldName}`);
    
    if (files[fieldName] && files[fieldName].length > 0) {
      const file = files[fieldName][0];
      console.log(`Processing image ${i}: ${file.originalname}`);
      
      // Get local path and add to uploads directory
      const localFilePath = path.join(__dirname, 'uploads', file.filename);
      let storagePath = `/uploads/${file.filename}`;
      
      // Extract metadata from the local file BEFORE S3 upload
      let fileSize = file.size || 0;
      
      // Always extract metadata from local file if the function is provided
      if (extractMetadata) {
        try {
          // Always use the local file path for metadata extraction
          const metadata = await extractMetadata(localFilePath, date);
          if (metadata.fileSize) {
            fileSize = metadata.fileSize;
          }
          if (metadata.width && metadata.height) {
            // Update the outer scope variables with dimensions from the first image
            if (width === null && height === null) {
              width = metadata.width;
              height = metadata.height;
              console.log(`Extracted dimensions for image sequence: ${width}×${height}`);
            }
          }
        } catch (metadataError) {
          console.error(`Error extracting metadata for sequence image ${i}:`, metadataError);
        }
      }
      
      // If S3 is configured, upload to S3 after extracting metadata from local file
      if (isS3Configured) {
        try {
          const s3Url = await uploadLocalFileToS3(localFilePath);
          if (s3Url) {
            console.log(`Uploaded sequence image ${i} to S3: ${s3Url}`);
            storagePath = s3Url;
            
            // Clean up the local file after successful S3 upload
            try {
              if (fs.existsSync(localFilePath)) {
                fs.unlinkSync(localFilePath);
                console.log(`Deleted local file ${localFilePath} after S3 upload`);
              }
            } catch (cleanupError) {
              console.error(`Error cleaning up local file ${localFilePath}:`, cleanupError);
              // Continue even if cleanup fails - file will be stored in S3
            }
          }
        } catch (s3Error) {
          console.error(`Error uploading sequence image ${i} to S3:`, s3Error);
        }
      }
      
      // Add to the result arrays
      sequencePaths.push(storagePath);
      originalFileNames.push(file.originalname);
      fileSizes.push(fileSize);
      totalSize += fileSize;
    }
  }
  
  console.log(`Processed total of ${sequencePaths.length} images in sequence (${sequencePaths.length - existingImageSequence.length} new, ${existingImageSequence.length} existing), total size: ${totalSize} bytes`);
  
  return {
    imageSequence: sequencePaths,
    imageSequenceOriginalFileNames: originalFileNames,
    imageSequenceFileSizes: fileSizes,
    totalSequenceSize: totalSize,
    imageSequenceCount: sequencePaths.length,
    // Include the image dimensions in the returned metadata
    // These will be available to the card creation/update route
    width: width,
    height: height
  };
}

module.exports = { processImageSequence };