const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const { VIDEO_DIMENSIONS, PREVIEW_SETTINGS } = require('./mediaConstants');

// Set the ffmpeg and ffprobe paths
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

/**
 * Extracts a preview frame from a video file at the first frame (0 seconds)
 * 
 * @param {string} videoPath - Path to the video file
 * @param {string} outputDir - Directory to save the extracted frame
 * @returns {Promise<string>} - Path to the extracted frame
 */
async function extractVideoFrame(videoPath, outputDir) {
  console.log('Extracting video frame from:', videoPath);
  console.log('Output directory:', outputDir);
  
  return new Promise((resolve, reject) => {
    // Verify the video file exists
    if (!fs.existsSync(videoPath)) {
      console.error(`Video file does not exist: ${videoPath}`);
      return reject(new Error(`Video file does not exist: ${videoPath}`));
    }
    
    console.log('Video file exists, generating thumbnail...');
    
    // Create a filename for the image
    const imageFilename = `${path.basename(videoPath, path.extname(videoPath))}-preview-${uuidv4().substring(0, 8)}.jpg`;
    const outputPath = path.join(outputDir, imageFilename);
    
    console.log(`Output image will be saved as: ${outputPath}`);

    // Ensure the output directory exists
    if (!fs.existsSync(outputDir)) {
      console.log(`Creating output directory: ${outputDir}`);
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Try to generate thumbnail, but create a fallback if it fails
    generateThumbnail(videoPath, outputPath, imageFilename, outputDir)
      .then(result => resolve(result))
      .catch(err => {
        console.error('Thumbnail generation failed, creating fallback image...', err);
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
        console.log('Generated filename:', filenames.join(', '));
      })
      .on('start', (commandLine) => {
        console.log('FFmpeg command:', commandLine);
      })
      .on('end', () => {
        console.log(`Successfully extracted thumbnail from ${videoPath}`);
        
        // Verify the file was created
        if (fs.existsSync(outputPath)) {
          console.log(`Output file exists: ${outputPath}, size: ${fs.statSync(outputPath).size} bytes`);
          resolve(outputPath);
        } else {
          console.error(`Output file not found: ${outputPath}`);
          reject(new Error(`Output file not found: ${outputPath}`));
        }
      })
      .on('error', (err) => {
        console.error(`Error extracting frame from video: ${err.message}`);
        reject(err);
      });
    
    // Use the very first frame (0 seconds)
    console.log(`Using first frame (${PREVIEW_SETTINGS.TIMESTAMP}) for thumbnail`);
    
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
      console.error('Error setting up screenshot command:', cmdError);
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
    console.log('Creating fallback image at:', outputPath);
    
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
    
    console.log(`Using random color: rgb(${r},${g},${b})`);
    
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
    
    console.log('Created fallback image successfully:', outputPath);
    return outputPath;
  } catch (error) {
    console.error('Error creating fallback image:', error);
    throw error;
  }
}

/**
 * Format seconds into HH:MM:SS.XXX timecode format
 * 
 * @param {number} seconds 
 * @returns {string} Formatted timecode
 */
function formatTimeToTimecode(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
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
      console.error(`Video file does not exist: ${videoPath}`);
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
    
    console.log('Getting video metadata for:', videoPath);
    
    try {
      // Wrap ffprobe in a try/catch to ensure we never throw errors
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          console.error('Error getting video metadata:', err);
          // Return fallback stats instead of rejecting
          try {
            const stat = fs.statSync(videoPath);
            console.log('Using basic file stats as fallback:', stat.size);
            
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
            console.error('Error getting file stats:', statError);
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
          console.log('Raw metadata received:', JSON.stringify(metadata.format, null, 2));
          
          // Find video stream safely
          let videoStream = null;
          if (metadata.streams && Array.isArray(metadata.streams)) {
            videoStream = metadata.streams.find(stream => stream && stream.codec_type === 'video');
          }
          
          console.log('Video stream:', videoStream ? JSON.stringify(videoStream, null, 2) : 'Not found');
          
          // Extract useful metadata with safe fallbacks
          const result = {
            duration: metadata.format?.duration || 0, // In seconds
            size: metadata.format?.size || 0, // In bytes
            bitrate: metadata.format?.bit_rate || 0,
            width: videoStream?.width || 0,
            height: videoStream?.height || 0,
            codec: videoStream?.codec_name || 'unknown',
            fps: videoStream?.r_frame_rate ? eval(videoStream.r_frame_rate) : 0
          };
          
          console.log('Extracted metadata:', result);
          resolve(result);
        } catch (parseError) {
          console.error('Error parsing metadata:', parseError);
          
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
      console.error('Error probing video file:', probeError);
      
      // Return minimal metadata as fallback
      try {
        // Get basic file information as fallback
        const stat = fs.statSync(videoPath);
        console.log('Using basic file stats as fallback:', stat.size);
        
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
        console.error('Error getting file stats:', statError);
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
