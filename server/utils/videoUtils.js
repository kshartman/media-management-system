const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const { VIDEO_DIMENSIONS, PREVIEW_SETTINGS } = require('./mediaConstants');
const logger = require('./logger').child({ module: 'videoUtils' });

// Set the ffmpeg and ffprobe paths
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

/**
 * Safely parses a fraction string (e.g., "30/1") to a decimal number
 * @param {string} fractionStr - The fraction string to parse
 * @returns {number} - The decimal result or 0 if invalid
 */
function parseFraction(fractionStr) {
  if (!fractionStr || typeof fractionStr !== 'string') return 0;
  
  const parts = fractionStr.split('/');
  if (parts.length !== 2) return 0;
  
  const numerator = parseFloat(parts[0]);
  const denominator = parseFloat(parts[1]);
  
  if (isNaN(numerator) || isNaN(denominator) || denominator === 0) return 0;
  
  return numerator / denominator;
}

/**
 * Extracts a preview frame from a video file at the first frame (0 seconds)
 * 
 * @param {string} videoPath - Path to the video file
 * @param {string} outputDir - Directory to save the extracted frame
 * @returns {Promise<string>} - Path to the extracted frame
 */
async function extractVideoFrame(videoPath, outputDir) {
  logger.info('Extracting video frame from:', { videoPath });
  logger.info('Output directory:', { outputDir });
  
  return new Promise((resolve, reject) => {
    // Verify the video file exists
    if (!fs.existsSync(videoPath)) {
      const error = new Error(`Video file does not exist: ${videoPath}`);
      logger.error(`Video file does not exist: ${videoPath}`, error);
      return reject(error);
    }
    
    logger.info('Video file exists, generating thumbnail...');
    
    // Create a filename for the image
    const imageFilename = `${path.basename(videoPath, path.extname(videoPath))}-preview-${uuidv4().substring(0, 8)}.jpg`;
    const outputPath = path.join(outputDir, imageFilename);
    
    logger.info('Output image will be saved as:', { outputPath });

    // Ensure the output directory exists
    if (!fs.existsSync(outputDir)) {
      logger.info('Creating output directory:', { outputDir });
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Try to generate thumbnail, but create a fallback if it fails
    generateThumbnail(videoPath, outputPath, imageFilename, outputDir)
      .then(result => resolve(result))
      .catch(err => {
        logger.error('Thumbnail generation failed, creating fallback image...', err);
        createFallbackImage(videoPath, outputPath)
          .then(fallbackPath => resolve(fallbackPath))
          .catch(fallbackErr => reject(fallbackErr));
      });
  });
}

/**
 * Attempts to generate a thumbnail from a video file
 * 
 * @param {string} videoPath - Path to the video file
 * @param {string} outputPath - Output path for the generated image
 * @param {string} imageFilename - Filename for the output image
 * @param {string} outputDir - Directory to save the output image
 * @returns {Promise<string>} - Path to the generated thumbnail
 */
function generateThumbnail(videoPath, outputPath, imageFilename, outputDir) {
  return new Promise((resolve, reject) => {
    // Create a ffmpeg command 
    const command = ffmpeg(videoPath);
    
    // Set up the thumbnail extraction with event handlers
    command
      .on('filenames', (filenames) => {
        logger.debug('Generated filename:', { filenames: filenames.join(', ') });
      })
      .on('start', (commandLine) => {
        logger.debug('FFmpeg command:', { commandLine });
      })
      .on('end', () => {
        logger.info('Successfully extracted thumbnail from:', { videoPath });
        
        // Verify the file was created
        if (fs.existsSync(outputPath)) {
          const fileSize = fs.statSync(outputPath).size;
          logger.info('Output file exists:', { outputPath, size: fileSize });
          resolve(outputPath);
        } else {
          const error = new Error(`Output file not found: ${outputPath}`);
          logger.error(`Output file not found: ${outputPath}`, error);
          reject(error);
        }
      })
      .on('error', (err) => {
        logger.error(`Error extracting frame from video: ${err.message}`, err);
        reject(err);
      });
    
    // Use the very first frame (0 seconds)
    logger.info('Using first frame for thumbnail:', { timestamp: PREVIEW_SETTINGS.TIMESTAMP });
    
    try {
      // Take the screenshot at the beginning of the video
      command
        .screenshots({
          timestamps: [PREVIEW_SETTINGS.TIMESTAMP],
          filename: imageFilename,
          folder: outputDir,
          size: `${VIDEO_DIMENSIONS.WIDTH}x${VIDEO_DIMENSIONS.HEIGHT}` // Portrait orientation
        });
    } catch (cmdError) {
      logger.error('Error setting up screenshot command:', cmdError);
      reject(cmdError);
    }
  });
}

/**
 * Creates a fallback image for videos when thumbnail extraction fails
 * 
 * @param {string} videoPath - Original video path (for display purposes)
 * @param {string} outputPath - Path to save the generated image
 * @returns {Promise<string>} - Path to the generated fallback image
 */
async function createFallbackImage(videoPath, outputPath) {
  try {
    logger.info('Creating fallback image at:', { outputPath });
    
    // Get the filename for display
    const displayName = path.basename(videoPath, path.extname(videoPath))
      .replace(/_/g, ' ')
      .replace(/-/g, ' ');
      
    // Set dimensions from constants
    const width = VIDEO_DIMENSIONS.WIDTH;
    const height = VIDEO_DIMENSIONS.HEIGHT;
    
    // Create a simple colored background
    // Generate a random color
    const r = Math.floor(Math.random() * 200) + 25; // 25-225 for better visibility
    const g = Math.floor(Math.random() * 200) + 25;
    const b = Math.floor(Math.random() * 200) + 25;
    
    logger.debug('Using random color:', { color: `rgb(${r},${g},${b})` });
    
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
            <text x="${width/2}" y="${height/2}" text-anchor="middle" font-family="Arial" font-size="32" fill="white">${displayName}</text>
          </svg>
        `),
        top: 0,
        left: 0
      }
    ])
    .jpeg({ quality: PREVIEW_SETTINGS.QUALITY })
    .toFile(outputPath);
    
    logger.info('Created fallback image successfully:', { outputPath });
    return outputPath;
  } catch (error) {
    logger.error('Error creating fallback image:', error);
    throw error;
  }
}


/**
 * Gets video metadata including dimensions, duration, and codec information
 * 
 * @param {string} videoPath - Path to the video file
 * @returns {Promise<Object>} - Video metadata
 */
async function getVideoMetadata(videoPath) {
  return new Promise((resolve) => {
    // Verify the video file exists
    if (!fs.existsSync(videoPath)) {
      logger.error(`Video file does not exist: ${videoPath}`);
      // Return default metadata rather than rejecting
      return resolve({
        duration: 0,
        size: 0,
        bitrate: 0,
        width: 0,
        height: 0,
        codec: 'unknown',
        fps: 0
      });
    }
    
    logger.info('Getting video metadata for:', { videoPath });
    
    try {
      // Wrap ffprobe in a try/catch to ensure we never throw errors
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          logger.error('Error getting video metadata:', err);
          // Return fallback stats instead of rejecting
          try {
            const stat = fs.statSync(videoPath);
            logger.info('Using basic file stats as fallback:', { size: stat.size });
            
            return resolve({
              duration: 0,
              size: stat.size,
              bitrate: 0,
              width: 0,
              height: 0,
              codec: 'unknown',
              fps: 0
            });
          } catch (statError) {
            logger.error('Error getting file stats:', statError);
            return resolve({
              duration: 0,
              size: 0,
              bitrate: 0,
              width: 0,
              height: 0,
              codec: 'unknown',
              fps: 0
            });
          }
        }
        
        try {
          logger.debug('Raw metadata received:', { metadata: metadata.format });
          
          // Find video stream safely
          let videoStream = null;
          if (metadata.streams && Array.isArray(metadata.streams)) {
            videoStream = metadata.streams.find(stream => stream && stream.codec_type === 'video');
          }
          
          logger.debug('Video stream:', { videoStream: videoStream || 'Not found' });
          
          // Extract useful metadata with safe fallbacks
          const result = {
            duration: metadata.format?.duration || 0, // In seconds
            size: metadata.format?.size || 0, // In bytes
            bitrate: metadata.format?.bit_rate || 0,
            width: videoStream?.width || 0,
            height: videoStream?.height || 0,
            codec: videoStream?.codec_name || 'unknown',
            fps: videoStream?.r_frame_rate ? parseFraction(videoStream.r_frame_rate) : 0
          };
          
          logger.info('Extracted metadata:', { result });
          resolve(result);
        } catch (parseError) {
          logger.error('Error parsing metadata:', parseError);
          
          // Return minimal metadata to avoid breaking the application
          try {
            resolve({
              duration: 0,
              size: fs.statSync(videoPath).size,
              bitrate: 0,
              width: 0,
              height: 0,
              codec: 'unknown',
              fps: 0
            });
          } catch (fileError) {
            resolve({
              duration: 0,
              size: 0,
              bitrate: 0,
              width: 0,
              height: 0,
              codec: 'unknown',
              fps: 0
            });
          }
        }
      });
    } catch (probeError) {
      logger.error('Error probing video file:', probeError);
      
      // Return minimal metadata as fallback
      try {
        // Get basic file information as fallback
        const stat = fs.statSync(videoPath);
        logger.info('Using basic file stats as fallback:', { size: stat.size });
        
        resolve({
          duration: 0,
          size: stat.size,
          bitrate: 0,
          width: 0,
          height: 0,
          codec: 'unknown',
          fps: 0
        });
      } catch (statError) {
        logger.error('Error getting file stats:', statError);
        // Even if we can't get file stats, return something instead of failing
        resolve({
          duration: 0,
          size: 0,
          bitrate: 0,
          width: 0,
          height: 0, 
          codec: 'unknown',
          fps: 0
        });
      }
    }
  });
}

module.exports = {
  extractVideoFrame,
  getVideoMetadata
};
