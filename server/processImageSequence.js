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
 * @returns {Promise<object>} - Object with paths and metadata
 */
async function processImageSequence(req, files, date, extractMetadata) {
  // Get the sequence count from the request body
  const sequenceCount = parseInt(req.body.imageSequenceCount || '0', 10);
  
  if (sequenceCount <= 0) {
    console.log('No image sequence files detected');
    return {
      imageSequence: [],
      imageSequenceOriginalFileNames: [],
      imageSequenceFileSizes: [],
      totalSequenceSize: 0,
      imageSequenceCount: 0
    };
  }
  
  console.log(`Processing ${sequenceCount} image sequence files`);
  const sequencePaths = [];
  const originalFileNames = [];
  const fileSizes = [];
  let totalSize = 0;
  
  // Process each image in the sequence
  for (let i = 0; i < sequenceCount; i++) {
    const fieldName = `imageSequence_${i}`;
    console.log(`Looking for field: ${fieldName}`);
    
    if (files[fieldName] && files[fieldName].length > 0) {
      const file = files[fieldName][0];
      console.log(`Processing image ${i}: ${file.originalname}`);
      
      // Get local path and add to uploads directory
      const localFilePath = path.join(__dirname, 'uploads', file.filename);
      let storagePath = `/uploads/${file.filename}`;
      
      // If S3 is configured, upload to S3 after processing locally
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
      
      // Extract metadata if function is provided
      let fileSize = file.size || 0;
      
      if (extractMetadata && !isS3Configured) {
        try {
          const metadata = await extractMetadata(storagePath, date);
          if (metadata.fileSize) {
            fileSize = metadata.fileSize;
          }
        } catch (metadataError) {
          console.error(`Error extracting metadata for sequence image ${i}:`, metadataError);
        }
      }
      
      // Add to the result arrays
      sequencePaths.push(storagePath);
      originalFileNames.push(file.originalname);
      fileSizes.push(fileSize);
      totalSize += fileSize;
    }
  }
  
  console.log(`Processed ${sequencePaths.length} images in sequence, total size: ${totalSize} bytes`);
  
  return {
    imageSequence: sequencePaths,
    imageSequenceOriginalFileNames: originalFileNames,
    imageSequenceFileSizes: fileSizes,
    totalSequenceSize: totalSize,
    imageSequenceCount: sequencePaths.length
  };
}

module.exports = { processImageSequence };