/**
 * Utility for creating downloadable zip archives from image sequences
 */
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const { getFileUrl, getSignedFileUrl, getFilenameFromUrl } = require('./s3Storage');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

/**
 * Create a ZIP file from an image sequence
 * @param {string[]} imagePaths - Array of image paths
 * @param {string[]} originalFilenames - Array of original filenames
 * @param {string} cardTitle - Title to use for the ZIP file
 * @returns {Promise<string>} - Path to the created ZIP file
 */
async function createSequenceZip(imagePaths, originalFilenames, cardTitle) {
  if (!imagePaths || !imagePaths.length) {
    throw new Error('No images provided for ZIP archive');
  }

  const timestamp = Date.now();
  const zipFilename = `${timestamp}-${cardTitle || 'image-sequence'}-${uuidv4().substring(0, 8)}.zip`;
  const zipPath = path.join(__dirname, '..', 'uploads', zipFilename);
  
  console.log(`Creating ZIP archive: ${zipPath}`);

  // Create a new JSZip instance
  const zip = new JSZip();
  
  // Process each image in the sequence
  for (let i = 0; i < imagePaths.length; i++) {
    const imagePath = imagePaths[i];
    // Use the original filename if available, otherwise use a generated name
    const filename = originalFilenames && originalFilenames[i] 
      ? originalFilenames[i] 
      : `image-${i + 1}${path.extname(imagePath)}`;

    try {
      // Check if this is an S3 URL or a local path
      if (imagePath.startsWith('http')) {
        // Get a signed URL if needed
        const fileUrl = await getSignedFileUrl(imagePath);
        
        // Download the file to a buffer
        const response = await axios({
          method: 'GET',
          url: fileUrl,
          responseType: 'arraybuffer'
        });

        // Add the buffer to the zip with the original filename
        zip.file(filename, response.data);
        console.log(`Added file from S3 to ZIP: ${filename}`);
      } else {
        // It's a local file path
        const fullPath = path.join(__dirname, '..', imagePath);
        const fileData = fs.readFileSync(fullPath);
        zip.file(filename, fileData);
        console.log(`Added local file to ZIP: ${filename}`);
      }
    } catch (error) {
      console.error(`Error adding file to ZIP: ${filename}`, error);
      // Continue with other files
    }
  }

  // Generate the ZIP file
  return new Promise((resolve, reject) => {
    zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true })
      .pipe(fs.createWriteStream(zipPath))
      .on('finish', () => {
        console.log(`ZIP archive created: ${zipPath}`);
        resolve(`/uploads/${zipFilename}`);
      })
      .on('error', (err) => {
        console.error('Error generating ZIP file:', err);
        reject(err);
      });
  });
}

module.exports = { createSequenceZip };