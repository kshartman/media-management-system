const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { Card } = require('../models');
const { createCardZip } = require('../utils/zipCardFiles');
const { getSignedFileUrl, isS3Configured } = require('../utils/s3Storage');
const logger = require('../utils/logger');

const fileLogger = logger.child({ component: 'files' });
const s3Logger = logger.child({ component: 's3-files' });

// Helper function to get base URL
const getBaseUrl = (req) => {
  // Force HTTPS in production environment
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : req.protocol;
  return `${protocol}://${req.get('host')}`;
};

// Route to download all card files as a ZIP
router.get('/cards/:id/download-package', async (req, res) => {
  try {
    const cardId = req.params.id;
    fileLogger.info(`Preparing download package for card ${cardId}`);
    
    // Get the card
    const card = await Card.findById(cardId);
    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }
    
    fileLogger.info(`Creating download package for ${card.type} card`);
    
    // Make sure we're working with a plain object, not a Mongoose document
    const cardData = card.toObject ? card.toObject() : JSON.parse(JSON.stringify(card));
    
    // Create the ZIP file with all card files
    const zipPath = await createCardZip(cardData);
    
    // Return a local server URL for the ZIP file instead of S3
    const baseUrl = getBaseUrl(req);
    const zipFilename = path.basename(zipPath);
    const localZipUrl = `${baseUrl}/api/download-zip/${zipFilename}`;
    res.json({ downloadUrl: localZipUrl });
  } catch (error) {
    fileLogger.error('Error creating download package:', error);
    res.status(500).json({ error: 'Failed to create download package' });
  }
});

// Route to serve ZIP files directly from local server
router.get('/download-zip/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const zipPath = path.join(__dirname, '..', 'uploads', filename);
    
    // Security check: ensure filename doesn't contain path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    // Check if file exists
    if (!fs.existsSync(zipPath)) {
      return res.status(404).json({ error: 'ZIP file not found' });
    }
    
    // Set appropriate headers for ZIP download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Stream the file
    fileLogger.info(`Serving ZIP file: ${zipPath}`);
    const fileStream = fs.createReadStream(zipPath);
    fileStream.pipe(res);
    
    fileStream.on('error', (err) => {
      fileLogger.error('Error streaming ZIP file:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error downloading file' });
      }
    });
    
  } catch (error) {
    fileLogger.error('Error serving ZIP file:', error);
    res.status(500).json({ error: 'Failed to serve ZIP file' });
  }
});

// Generate signed URL for S3 files
router.post('/files/signed-url', async (req, res) => {
  try {
    const { fileUrl } = req.body;
    
    if (!fileUrl) {
      return res.status(400).json({ error: 'File URL is required' });
    }
    
    // Check if this is an S3 URL and we have S3 configured
    if (!isS3Configured || (!fileUrl.includes('amazonaws.com') && !fileUrl.includes('s3.'))) {
      return res.status(400).json({ error: 'Not an S3 URL or S3 not configured' });
    }
    
    // Extract the S3 key from the URL
    let s3Key;
    if (fileUrl.includes('amazonaws.com/')) {
      s3Key = fileUrl.split('amazonaws.com/')[1];
    } else {
      // For other S3 URL formats, try to extract the key
      const urlParts = fileUrl.split('/');
      s3Key = urlParts.slice(3).join('/'); // Everything after the domain
    }
    
    s3Logger.info(`Generating signed URL for S3 key: ${s3Key}`);
    
    // Generate signed URL (valid for 1 hour)
    const signedUrl = await getSignedFileUrl(s3Key, 3600);
    
    if (!signedUrl) {
      return res.status(500).json({ error: 'Failed to generate signed URL' });
    }
    
    res.json({ signedUrl });
  } catch (error) {
    fileLogger.error('Error generating signed URL:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;