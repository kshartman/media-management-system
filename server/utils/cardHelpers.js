const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { getFileUrl, getStorage, uploadLocalFileToS3, isS3Configured } = require('./s3Storage');
const { getVideoMetadata, extractVideoFrame } = require('./videoUtils');
const { generateAndUploadPreview } = require('../generatePreview');
const { Tag, Card } = require('../models');
const logger = require('./logger');
const { VIDEO_DIMENSIONS } = require('./mediaConstants');

const cardLogger = logger.child({ component: 'card-helpers' });
const fileLogger = logger.child({ component: 'file-helpers' });
const s3Logger = logger.child({ component: 's3-helpers' });

// Get base URL for the server
const getBaseUrl = (req) => {
  return `${req.protocol}://${req.get('host')}`;
};

// Get all tags from the database
const getAllTags = async () => {
  try {
    // Get all tags from the dedicated Tag collection
    const tags = await Tag.find({}).sort({ name: 1 });
    const tagNames = tags.map(tag => tag.name);
    return tagNames;
  } catch (error) {
    cardLogger.error('Error getting all tags:', error);
    return [];
  }
};

// Process tags when creating or updating cards
const processTags = async (tagsList) => {
  if (!tagsList || !Array.isArray(tagsList) || tagsList.length === 0) {
    return;
  }

  try {
    // Process each tag in the list
    for (const tagName of tagsList) {
      const trimmedTag = tagName.trim();
      if (!trimmedTag) {
        continue; // Skip empty tags
      }

      // Use upsert to create tag if it doesn't exist or increment count if it does
      await Tag.findOneAndUpdate(
        { name: trimmedTag },
        { $inc: { count: 1 } },
        { upsert: true, new: true }
      );
    }
  } catch (error) {
    cardLogger.error('Error processing tags:', error);
  }
};

// Update tag counts (decrement when tags are removed)
const updateTagCounts = async (oldTags, newTags) => {
  try {
    // Find tags that were removed
    const removedTags = oldTags.filter(tag => !newTags.includes(tag));
    
    // Decrement count for removed tags
    for (const tagName of removedTags) {
      await Tag.findOneAndUpdate(
        { name: tagName },
        { $inc: { count: -1 } }
      );
      
      // Remove tags with count 0 or less
      await Tag.deleteMany({ count: { $lte: 0 } });
    }
    
    // Find newly added tags
    const addedTags = newTags.filter(tag => !oldTags.includes(tag));
    
    // Process newly added tags
    if (addedTags.length > 0) {
      await processTags(addedTags);
    }
  } catch (error) {
    cardLogger.error('Error updating tag counts:', error);
  }
};

// Process file and get storage path
const processFileAndGetPath = async (localFilePath, fieldName) => {
  let dbPath = `/uploads/${path.basename(localFilePath)}`;
  
  if (isS3Configured) {
    fileLogger.info(`${fieldName} file received, attempting S3 upload...`);
    
    try {
      const s3Url = await uploadLocalFileToS3(localFilePath);
      if (s3Url) {
        s3Logger.info(`Successfully uploaded ${fieldName} to S3: ${s3Url}`);
        
        // Return the S3 URL for database storage
        dbPath = s3Url;
        
        // Clean up the local file after successful S3 upload
        try {
          if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
            fileLogger.debug(`Deleted local file ${localFilePath} after S3 upload`);
          }
        } catch (cleanupError) {
          fileLogger.error(`Error cleaning up local file ${localFilePath}:`, cleanupError);
          // Continue even if cleanup fails - file will be stored in S3
        }
      } else {
        s3Logger.error(`Failed to upload ${fieldName} to S3, using local path instead`);
        // Keep the local path if S3 upload failed
      }
    } catch (error) {
      s3Logger.error(`Error uploading ${fieldName} to S3:`, error);
    }
  }

  return dbPath;
};

// Download file from URL to local path
const downloadFile = async (url, destPath) => {
  fileLogger.info(`Downloading file from ${url} to ${destPath}`);

  // Validate URL
  if (!url || typeof url !== 'string' || (!url.startsWith('http://') && !url.startsWith('https://'))) {
    fileLogger.error(`Invalid URL format: ${url}`);
    throw new Error(`Invalid URL format: ${url}`);
  }

  const response = await fetch(url, {
    signal: AbortSignal.timeout(30000) // 30 second timeout
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} downloading ${url}`);
  }

  const writer = fs.createWriteStream(destPath);
  const nodeStream = Readable.fromWeb(response.body);

  return new Promise((resolve, reject) => {
    nodeStream.pipe(writer);

    writer.on('finish', () => {
      fileLogger.info(`Successfully downloaded file to ${destPath}`);
      resolve(true);
    });

    writer.on('error', (err) => {
      fileLogger.error(`Error writing file ${destPath}:`, err);
      reject(err);
    });

    nodeStream.on('error', (err) => {
      fileLogger.error(`Error downloading file from ${url}:`, err);
      reject(err);
    });
  });
};

// Process video and generate preview
const processVideoAndGeneratePreview = async (videoFile, metadata, cardType, forcePreviewGeneration = false) => {
  const storage = getStorage();
  const videoPath = videoFile.path;
  let previewPath = null;
  let dbVideoPath = null;
  let dbPreviewPath = null;
  let previewSource = 'auto-generated';
  
  // Process the video file
  if (isS3Configured) {
    fileLogger.info('Uploading video to S3...');
    const s3VideoUrl = await uploadLocalFileToS3(videoPath);
    if (s3VideoUrl) {
      dbVideoPath = s3VideoUrl;
      s3Logger.info(`Video uploaded to S3: ${s3VideoUrl}`);
      
      try {
        // Try to generate preview directly from S3 URL
        const s3PreviewUrl = await generateAndUploadPreview(s3VideoUrl);
        if (s3PreviewUrl) {
          dbPreviewPath = s3PreviewUrl;
          previewSource = 'auto-generated';
          s3Logger.info(`Preview generated and uploaded to S3: ${s3PreviewUrl}`);
        }
      } catch (s3PreviewError) {
        fileLogger.warn('Failed to generate preview from S3 URL, falling back to local generation:', s3PreviewError);
        
        // Fall back to local preview generation
        try {
          const outputDir = path.dirname(videoPath);
          const localPreviewPath = await extractVideoFrame(videoPath, outputDir);
          
          if (fs.existsSync(localPreviewPath)) {
            if (isS3Configured) {
              const s3PreviewUrl = await uploadLocalFileToS3(localPreviewPath);
              if (s3PreviewUrl) {
                dbPreviewPath = s3PreviewUrl;
                previewSource = 'auto-generated';
                fs.unlinkSync(localPreviewPath);
              } else {
                dbPreviewPath = `/uploads/${path.basename(localPreviewPath)}`;
                previewSource = 'auto-generated';
              }
            } else {
              dbPreviewPath = `/uploads/${path.basename(localPreviewPath)}`;
              previewSource = 'auto-generated';
            }
          }
        } catch (localPreviewError) {
          fileLogger.error('Failed to generate preview locally:', localPreviewError);
          previewSource = 'fallback';
        }
      }
      
      // Clean up local video file after successful S3 upload
      try {
        fs.unlinkSync(videoPath);
        fileLogger.debug(`Deleted local video file after S3 upload: ${videoPath}`);
      } catch (cleanupError) {
        fileLogger.error('Error deleting local video file:', cleanupError);
      }
    } else {
      // S3 upload failed, use local paths
      dbVideoPath = `/uploads/${path.basename(videoPath)}`;
      
      // Generate preview locally
      try {
        const outputDir = path.dirname(videoPath);
        const localPreviewPath = await extractVideoFrame(videoPath, outputDir);
        
        if (fs.existsSync(localPreviewPath)) {
          dbPreviewPath = `/uploads/${path.basename(localPreviewPath)}`;
          previewSource = 'auto-generated';
        }
      } catch (previewError) {
        fileLogger.error('Failed to generate preview for local video:', previewError);
        previewSource = 'fallback';
      }
    }
  } else {
    // No S3, use local paths
    dbVideoPath = `/uploads/${path.basename(videoPath)}`;
    
    // Generate preview locally
    try {
      const outputDir = path.dirname(videoPath);
      const localPreviewPath = await extractVideoFrame(videoPath, outputDir);
      
      if (fs.existsSync(localPreviewPath)) {
        dbPreviewPath = `/uploads/${path.basename(localPreviewPath)}`;
        previewSource = 'auto-generated';
      }
    } catch (previewError) {
      fileLogger.error('Failed to generate preview:', previewError);
      previewSource = 'fallback';
    }
  }
  
  // Get video metadata
  try {
    const videoMetadata = await getVideoMetadata(videoPath);
    metadata.width = videoMetadata.width || VIDEO_DIMENSIONS.WIDTH;
    metadata.height = videoMetadata.height || VIDEO_DIMENSIONS.HEIGHT;
    metadata.fileSize = videoFile.size;
    metadata.previewSource = previewSource;
  } catch (metadataError) {
    fileLogger.error('Error extracting video metadata:', metadataError);
    metadata.width = VIDEO_DIMENSIONS.WIDTH;
    metadata.height = VIDEO_DIMENSIONS.HEIGHT;
    metadata.fileSize = videoFile.size;
    metadata.previewSource = previewSource;
  }
  
  return { videoPath: dbVideoPath, previewPath: dbPreviewPath, previewSource };
};

// Generate preview from existing video path
const generatePreviewFromExistingVideo = async (videoPath, metadata) => {
  let dbPreviewPath = null;
  let previewSource = 'auto-generated';
  
  try {
    if (videoPath.startsWith('http')) {
      // Video is stored in S3, use the generate and upload preview function
      const s3PreviewUrl = await generateAndUploadPreview(videoPath);
      if (s3PreviewUrl) {
        dbPreviewPath = s3PreviewUrl;
        previewSource = 'auto-generated';
        s3Logger.info(`Preview regenerated and uploaded to S3: ${s3PreviewUrl}`);
      }
    } else {
      // Video is stored locally
      const localVideoPath = path.join(__dirname, '..', 'public', videoPath);
      
      if (fs.existsSync(localVideoPath)) {
        const tempDir = path.join(__dirname, '..', 'temp');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const localPreviewPath = path.join(
          tempDir,
          `preview-${Date.now()}-${path.basename(localVideoPath, path.extname(localVideoPath))}.jpg`
        );
        
        await extractVideoFrame(localVideoPath, localPreviewPath);
        
        if (fs.existsSync(localPreviewPath)) {
          if (isS3Configured) {
            const s3PreviewUrl = await uploadLocalFileToS3(localPreviewPath);
            if (s3PreviewUrl) {
              dbPreviewPath = s3PreviewUrl;
              previewSource = 'auto-generated';
              fs.unlinkSync(localPreviewPath);
            } else {
              dbPreviewPath = `/uploads/${path.basename(localPreviewPath)}`;
              previewSource = 'auto-generated';
            }
          } else {
            dbPreviewPath = `/uploads/${path.basename(localPreviewPath)}`;
            previewSource = 'auto-generated';
          }
        }
      } else {
        fileLogger.error(`Video file not found at path: ${localVideoPath}`);
        previewSource = 'fallback';
      }
    }
  } catch (error) {
    fileLogger.error('Error generating preview from existing video:', error);
    previewSource = 'fallback';
  }
  
  if (metadata) {
    metadata.previewSource = previewSource;
  }
  
  return { previewPath: dbPreviewPath, previewSource };
};

// Generate fallback preview for missing videos
const generateFallbackPreview = async (cardDescription, cardType = 'reel') => {
  let dbPreviewPath = null;
  const previewSource = 'fallback';
  
  try {
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const fallbackPreviewPath = path.join(tempDir, `fallback-${Date.now()}.jpg`);
    
    // Use the generateAndUploadPreview fallback logic
    
    // Create a simple fallback image using Sharp
    const sharp = require('sharp');
    const { VIDEO_DIMENSIONS, PREVIEW_SETTINGS } = require('./mediaConstants');
    
    const width = VIDEO_DIMENSIONS.WIDTH;
    const height = VIDEO_DIMENSIONS.HEIGHT;
    
    // Generate a random color for the background
    const r = Math.floor(Math.random() * 200) + 25;
    const g = Math.floor(Math.random() * 200) + 25;
    const b = Math.floor(Math.random() * 200) + 25;
    
    const displayText = cardDescription.length > 30 
      ? cardDescription.substring(0, 30) + '...' 
      : cardDescription;
    
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
            <text x="${width/2}" y="${height/2-40}" text-anchor="middle" font-family="Arial" font-size="28" fill="white">${displayText}</text>
            <text x="${width/2}" y="${height/2}" text-anchor="middle" font-family="Arial" font-size="20" fill="white">Video Missing</text>
            <text x="${width/2}" y="${height/2+30}" text-anchor="middle" font-family="Arial" font-size="16" fill="white">Upload a new video to generate preview</text>
          </svg>
        `),
        top: 0,
        left: 0
      }
    ])
    .jpeg({ quality: PREVIEW_SETTINGS.QUALITY })
    .toFile(fallbackPreviewPath);
    
    if (fs.existsSync(fallbackPreviewPath)) {
      if (isS3Configured) {
        const s3PreviewUrl = await uploadLocalFileToS3(fallbackPreviewPath);
        if (s3PreviewUrl) {
          dbPreviewPath = s3PreviewUrl;
          fs.unlinkSync(fallbackPreviewPath);
        } else {
          dbPreviewPath = `/uploads/${path.basename(fallbackPreviewPath)}`;
        }
      } else {
        dbPreviewPath = `/uploads/${path.basename(fallbackPreviewPath)}`;
      }
      
      fileLogger.info(`Generated fallback preview: ${dbPreviewPath}`);
    }
  } catch (error) {
    fileLogger.error('Error generating fallback preview:', error);
  }
  
  return { previewPath: dbPreviewPath, previewSource };
};

// Extract file metadata
const extractFileMetadata = async (file, providedDate = null) => {
  const filePath = file.path;
  const storage = getStorage();
  
  try {
    // Check if the file exists and is accessible
    const fileExists = fs.existsSync(filePath);
    
    if (!fileExists) {
      fileLogger.warn(`File not accessible at path: ${filePath}`);
      
      // Return default metadata for inaccessible files
      const extension = path.extname(file.originalname).toLowerCase();
      const guessedDimensions = guessDimensionsFromUrl(file.originalname);
      
      // For video files, use standard dimensions
      const videoExtensions = ['.mp4', '.mov', '.avi', '.webm'];
      
      if (videoExtensions.includes(extension)) {
        guessedDimensions.width = VIDEO_DIMENSIONS.WIDTH;    // 720 for portrait
        guessedDimensions.height = VIDEO_DIMENSIONS.HEIGHT;  // 1280 for portrait
        fileLogger.debug(`Using standard video dimensions for inaccessible video: ${guessedDimensions.width}×${guessedDimensions.height}`);
      }
      
      return {
        date: providedDate || new Date(),
        width: guessedDimensions.width,
        height: guessedDimensions.height,
        fileSize: null
      };
    }
    
    const metadata = {
      date: providedDate || new Date(),
      width: null,
      height: null,
      fileSize: file.size
    };
    
    // For video files, extract metadata using ffprobe
    if (file.mimetype && file.mimetype.startsWith('video/')) {
      try {
        const videoMetadata = await getVideoMetadata(filePath);
        metadata.width = videoMetadata.width;
        metadata.height = videoMetadata.height;
      } catch (videoError) {
        fileLogger.error('Error extracting video metadata:', videoError);
        // Use default video dimensions
        metadata.width = VIDEO_DIMENSIONS.WIDTH;
        metadata.height = VIDEO_DIMENSIONS.HEIGHT;
      }
    }
    // For image files, try to get dimensions
    else if (file.mimetype && file.mimetype.startsWith('image/')) {
      // Since we don't have sharp installed, we'll use default dimensions
      // In a production environment, you would use a library like 'sharp' or 'jimp'
      const guessedDimensions = guessDimensionsFromUrl(file.originalname);
      metadata.width = guessedDimensions.width;
      metadata.height = guessedDimensions.height;
    }
    
    return metadata;
  } catch (error) {
    fileLogger.error('Error extracting file metadata:', error);
    return {
      date: providedDate || new Date(),
      width: 1920, // Default width for images
      height: 1080, // Default height for images
      fileSize: null
    };
  }
};

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
    return { width: 1920, height: 400 };
  } else if (filename.includes('square')) {
    return { width: 1080, height: 1080 };
  } else if (filename.includes('portrait')) {
    return { width: 720, height: 1280 };
  } else if (filename.includes('landscape')) {
    return { width: 1920, height: 1080 };
  } else if (filename.includes('story') || filename.includes('reel')) {
    return { width: 1080, height: 1920 };
  }
  
  // Default dimensions
  return { width: 1920, height: 1080 };
}

module.exports = {
  getBaseUrl,
  getAllTags,
  processTags,
  updateTagCounts,
  processFileAndGetPath,
  downloadFile,
  processVideoAndGeneratePreview,
  generatePreviewFromExistingVideo,
  generateFallbackPreview,
  extractFileMetadata,
  guessDimensionsFromUrl
};