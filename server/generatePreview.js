const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const https = require('https');
const http = require('http');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
const { VIDEO_DIMENSIONS, PREVIEW_SETTINGS, S3_SETTINGS } = require('./utils/mediaConstants');
const logger = require('./utils/logger');
require('dotenv').config();

// Create a child logger for this module
const previewGenerator = logger.child({ module: 'previewGenerator' });

// Set the ffmpeg and ffprobe paths
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

/**
 * Downloads a file from a URL to a local destination path
 * @param {string} url - URL to download
 * @param {string} destPath - Local destination path
 * @returns {Promise<string>} - Path to the downloaded file
 */
const downloadFile = (url, destPath) => {
  return new Promise((resolve, reject) => {
    previewGenerator.debug(`Downloading file from ${url} to ${destPath}`);
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
        previewGenerator.debug(`Download complete, file saved to ${destPath}`);
        resolve(destPath);
      });
    });
    
    request.on('error', err => {
      fs.unlink(destPath, () => {});
      previewGenerator.error(`Error downloading file: ${err.message}`, err);
      reject(err);
    });
    
    file.on('error', err => {
      fs.unlink(destPath, () => {});
      previewGenerator.error(`Error saving file: ${err.message}`, err);
      reject(err);
    });
  });
};

/**
 * Extracts a frame from a video at the first frame (0 seconds)
 * @param {string} videoPath - Path to the video file
 * @param {string} outputPath - Path to save the extracted frame
 * @returns {Promise<string>} - Path to the extracted frame
 */
const extractFrameFromVideo = (videoPath, outputPath) => {
  return new Promise((resolve, reject) => {
    previewGenerator.debug(`Extracting frame from video at ${videoPath}`);
    
    // Verify the video file exists
    if (!fs.existsSync(videoPath)) {
      previewGenerator.error(`Video file does not exist: ${videoPath}`);
      return reject(new Error(`Video file does not exist: ${videoPath}`));
    }
    
    // Also check that the file has content
    try {
      const stats = fs.statSync(videoPath);
      if (stats.size === 0) {
        previewGenerator.error(`Video file is empty (0 bytes): ${videoPath}`);
        return reject(new Error(`Video file is empty (0 bytes): ${videoPath}`));
      }
      previewGenerator.debug(`Video file exists and has content: ${videoPath}, size: ${stats.size} bytes`);
    } catch (statError) {
      previewGenerator.error(`Error checking video file stats: ${statError.message}`, statError);
      return reject(statError);
    }
    
    ffmpeg(videoPath)
      .on('start', cmdline => {
        previewGenerator.debug(`Running ffmpeg command: ${cmdline}`);
      })
      .on('error', err => {
        previewGenerator.error(`Error extracting frame: ${err.message}`, err);
        reject(err);
      })
      .on('end', () => {
        previewGenerator.debug(`Frame extracted successfully to ${outputPath}`);
        resolve(outputPath);
      })
      .screenshots({
        count: 1,
        timestamps: [PREVIEW_SETTINGS.TIMESTAMP],
        filename: path.basename(outputPath),
        folder: path.dirname(outputPath),
        size: `${VIDEO_DIMENSIONS.WIDTH}x${VIDEO_DIMENSIONS.HEIGHT}`
      });
  });
};

/**
 * Generates a preview image for a video file and uploads it to S3
 * @param {string} videoPath - Path to the video file (can be URL or local file path)
 * @param {string} videoFilename - Optional filename of the video
 * @param {boolean} isLocalFile - Whether videoPath is a local file path (default: false)
 * @returns {Promise<string>} - URL of the generated preview
 */
async function generateAndUploadPreview(videoPath, videoFilename, isLocalFile = false) {
  previewGenerator.info('==================== PREVIEW GENERATOR START ====================');
  previewGenerator.info('Generating preview for video:', videoPath);
  previewGenerator.info('Video filename:', videoFilename);
  previewGenerator.info('Is local file:', isLocalFile);
  previewGenerator.debug('Input validation:');
  previewGenerator.debug('- videoPath type:', typeof videoPath, 'value:', videoPath);
  previewGenerator.debug('- videoFilename type:', typeof videoFilename, 'value:', videoFilename);
  previewGenerator.debug('- isLocalFile:', isLocalFile);
  previewGenerator.debug('- process.env.S3_BUCKET:', process.env.S3_BUCKET);
  previewGenerator.debug('- process.env.AWS_REGION:', process.env.AWS_REGION);
  previewGenerator.debug('- process.env.AWS_ACCESS_KEY_ID exists:', !!process.env.AWS_ACCESS_KEY_ID);
  previewGenerator.debug('- process.env.AWS_SECRET_ACCESS_KEY exists:', !!process.env.AWS_SECRET_ACCESS_KEY);
  previewGenerator.debug('- process.env.S3_CUSTOM_DOMAIN:', process.env.S3_CUSTOM_DOMAIN);
  
  if (!videoPath) {
    const error = new Error('Invalid or missing video path');
    previewGenerator.error('ERROR:', error.message, error);
    previewGenerator.info('==================== PREVIEW GENERATOR ERROR ====================');
    throw error;
  }
  
  previewGenerator.debug('Will attempt to extract a frame from the video first');
  
  // If no filename was provided or is undefined, extract it from the path/URL
  if (!videoFilename) {
    try {
      if (isLocalFile) {
        // Just get the base filename if it's a local file
        videoFilename = path.basename(videoPath);
      } else {
        // Basic URL parsing to extract filename
        const urlParts = videoPath.split('/');
        const lastPart = urlParts[urlParts.length - 1].split('?')[0]; // Remove query params
        videoFilename = decodeURIComponent(lastPart);
      }
      previewGenerator.debug('Extracted filename:', videoFilename);
    } catch (error) {
      previewGenerator.debug('Failed to extract filename, using default');
      videoFilename = 'video';
    }
  }
  
  try {
    // Create temp directory if it doesn't exist
    const tempDir = path.join(__dirname, PREVIEW_SETTINGS.TEMP_DIR);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
      previewGenerator.debug(`Created temp directory: ${tempDir}`);
    } else {
      previewGenerator.debug(`Using existing temp directory: ${tempDir}`);
    }
    previewGenerator.debug('Temp directory path:', tempDir);
    
    // Set up filenames and paths using constants
    const width = VIDEO_DIMENSIONS.WIDTH;
    const height = VIDEO_DIMENSIONS.HEIGHT;
    const uuid = uuidv4();
    const previewFilename = `preview-${uuid.substring(0, 8)}.jpg`;
    const previewPath = path.join(tempDir, previewFilename);
    
    // We only need to create a temp video path if the source is a URL
    const tempVideoPath = isLocalFile ? videoPath : path.join(tempDir, `temp-video-${uuid.substring(0, 8)}${path.extname(videoFilename) || '.mp4'}`);
    
    previewGenerator.debug('Configuration:');
    previewGenerator.debug('- preview width:', width);
    previewGenerator.debug('- preview height:', height);
    previewGenerator.debug('- generated UUID:', uuid);
    previewGenerator.debug('- preview filename:', previewFilename);
    previewGenerator.debug('- preview path:', previewPath);
    previewGenerator.debug('- video path for processing:', tempVideoPath);
    
    // Get the filename without extension for display on the preview
    let displayName;
    try {
      displayName = path.basename(videoFilename || 'video', path.extname(videoFilename || '.mp4'))
        .replace(/_/g, ' ')
        .replace(/-/g, ' ');
      
      previewGenerator.debug('Display name for preview:', displayName);
    } catch (nameError) {
      previewGenerator.error('Error processing display name:', nameError.message, nameError);
      displayName = 'Video Preview';
    }
    
    // Try to process the video
    let frameExtracted = false;
    
    try {
      // If not a local file, download the video to a temp file
      if (!isLocalFile) {
        previewGenerator.debug('Step 1: Downloading video from', videoPath);
        await downloadFile(videoPath, tempVideoPath);
      } else {
        previewGenerator.debug('Using local file directly:', videoPath);
      }
      
      // Extract a frame using ffmpeg
      previewGenerator.debug('Step 2: Extracting frame...');
      await extractFrameFromVideo(tempVideoPath, previewPath);
      frameExtracted = true;
      
      previewGenerator.debug('Successfully extracted frame from video!');
    } catch (videoError) {
      previewGenerator.error('Error processing video, falling back to placeholder image:', videoError.message, videoError);
      
      // If frame extraction failed, we'll create a placeholder in the fallback section
      frameExtracted = false;
    }
    
    // Only create a placeholder if frame extraction failed
    if (!frameExtracted) {
      previewGenerator.debug('Creating fallback colored placeholder image');
      
      // Generate a random color
      const r = Math.floor(Math.random() * 200) + 25; // 25-225 for better visibility
      const g = Math.floor(Math.random() * 200) + 25;
      const b = Math.floor(Math.random() * 200) + 25;
      
      previewGenerator.debug(`Using random color: rgb(${r},${g},${b})`);
      previewGenerator.debug('Creating preview image with sharp...');
      
      try {
        await sharp({
          create: {
            width: width,
            height: height,
            channels: 4,
            background: { r, g, b, alpha: 1 }
          }
        })
        .composite([
          {
            input: Buffer.from(`
              <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
                <rect width="100%" height="100%" fill="rgb(${r},${g},${b})" />
                <text x="${width/2}" y="${height/2-20}" text-anchor="middle" font-family="Arial" font-size="32" fill="white">${displayName}</text>
                <text x="${width/2}" y="${height/2+20}" text-anchor="middle" font-family="Arial" font-size="20" fill="white">Video Preview</text>
              </svg>
            `),
            top: 0,
            left: 0
          }
        ])
        .jpeg({ quality: PREVIEW_SETTINGS.QUALITY })
        .toFile(previewPath);
      } catch (sharpError) {
        previewGenerator.error('Error creating fallback image:', sharpError.message, sharpError);
        throw sharpError; // If this fails too, we have bigger problems
      }
    }
    
    // Clean up the temporary video file if it exists and it's not a local file
    if (!isLocalFile) {
      try {
        if (fs.existsSync(tempVideoPath)) {
          fs.unlinkSync(tempVideoPath);
          previewGenerator.debug(`Cleaned up temporary video file: ${tempVideoPath}`);
        }
      } catch (cleanupError) {
        previewGenerator.error(`Error cleaning up temp video file: ${cleanupError.message}`, cleanupError);
      }
    }
    
    previewGenerator.debug('Preview image created successfully');
    
    // Check if the file was created
    if (!fs.existsSync(previewPath)) {
      throw new Error(`Preview file was not created at path: ${previewPath}`);
    }
    
    const fileStats = fs.statSync(previewPath);
    previewGenerator.debug('Preview file exists, size:', fileStats.size, 'bytes');
    
    // Now upload to S3
    previewGenerator.debug('Uploading preview to S3...');
    
    // Initialize S3 client
    previewGenerator.debug('Creating S3 client with:');
    previewGenerator.debug('- Region:', process.env.AWS_REGION);
    previewGenerator.debug('- Has access key:', !!process.env.AWS_ACCESS_KEY_ID);
    previewGenerator.debug('- Has secret key:', !!process.env.AWS_SECRET_ACCESS_KEY);
    
    let s3Client;
    try {
      s3Client = new S3Client({
        region: process.env.AWS_REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      });
      previewGenerator.debug('S3 client created successfully');
    } catch (s3ClientError) {
      previewGenerator.error('ERROR creating S3 client:', s3ClientError.message, s3ClientError);
      throw new Error(`Failed to create S3 client: ${s3ClientError.message}`);
    }
    
    // Read the preview image
    let fileContent;
    try {
      fileContent = fs.readFileSync(previewPath);
      previewGenerator.debug('Read preview image file, size:', fileContent.length, 'bytes');
    } catch (readError) {
      previewGenerator.error('ERROR reading preview file:', readError.message, readError);
      throw new Error(`Failed to read preview file: ${readError.message}`);
    }
    
    // S3 path where the preview will be stored
    const s3Key = `${S3_SETTINGS.PATH_PREFIX}${previewFilename}`;
    
    // Get S3 bucket name
    const bucketName = process.env.S3_BUCKET;
    if (!bucketName) {
      throw new Error('S3_BUCKET environment variable is not set');
    }
    
    previewGenerator.debug('Using S3 bucket:', bucketName);
    
    // Define S3 upload parameters
    const uploadParams = {
      Bucket: bucketName,
      Key: s3Key,
      Body: fileContent,
      ContentType: S3_SETTINGS.CONTENT_TYPES.JPEG
    };
    
    previewGenerator.debug('S3 upload parameters:', {
      bucket: bucketName,
      key: s3Key,
      contentType: S3_SETTINGS.CONTENT_TYPES.JPEG,
      fileSize: fileContent.length
    });
    
    // Upload to S3
    try {
      const command = new PutObjectCommand(uploadParams);
      const result = await s3Client.send(command);
      previewGenerator.debug('Preview image uploaded to S3 successfully, result:', result);
    } catch (uploadError) {
      previewGenerator.error('ERROR uploading to S3:', uploadError.message, uploadError);
      throw new Error(`Failed to upload to S3: ${uploadError.message}`);
    }
    
    // Generate the full S3 URL
    let previewUrl;
    if (process.env.S3_CUSTOM_DOMAIN) {
      previewUrl = `https://${process.env.S3_CUSTOM_DOMAIN}/${s3Key}`;
      previewGenerator.debug('Using custom domain for preview URL');
    } else {
      previewUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
      previewGenerator.debug('Using default S3 URL format for preview URL');
    }
    
    previewGenerator.debug('Final preview URL:', previewUrl);
    
    // Clean up the temporary file
    try {
      fs.unlinkSync(previewPath);
      previewGenerator.debug('Temporary file cleaned up successfully');
    } catch (cleanupError) {
      previewGenerator.warn('Warning: Failed to clean up temporary file:', cleanupError.message);
      // Continue even if cleanup fails - this is non-critical
    }
    
    previewGenerator.info('==================== PREVIEW GENERATOR SUCCESS ====================');
    // Return the S3 URL of the preview
    return previewUrl;
  } catch (error) {
    previewGenerator.error('==================== PREVIEW GENERATOR ERROR ====================');
    previewGenerator.error('ERROR generating or uploading preview:', error.message, error);
    previewGenerator.error('Error stack:', error.stack);
    // Add additional error info if present
    if (error.code) previewGenerator.error('Error code:', error.code);
    if (error.region) previewGenerator.error('Error region:', error.region);
    if (error.time) previewGenerator.error('Error time:', error.time);
    if (error.requestId) previewGenerator.error('Error requestId:', error.requestId);
    if (error.statusCode) previewGenerator.error('Error statusCode:', error.statusCode);
    if (error.retryable) previewGenerator.error('Error retryable:', error.retryable);
    if (error.message) previewGenerator.error('Error message:', error.message);
    previewGenerator.error('==================== END PREVIEW GENERATOR ERROR ====================');
    throw error;
  }
}

module.exports = { generateAndUploadPreview };