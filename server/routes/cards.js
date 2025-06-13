const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { Card, Tag } = require('../models');
const authMiddleware = require('../middleware/auth');
const { 
  handleCardUpload, 
  validateFiles, 
  preserveOriginalFileName, 
  validateCardType, 
  logReceivedFiles 
} = require('../middleware/upload');
const {
  getBaseUrl,
  getAllTags,
  processTags,
  updateTagCounts,
  processFileAndGetPath,
  downloadFile,
  processVideoAndGeneratePreview,
  extractFileMetadata
} = require('../utils/cardHelpers');
const { 
  getFileUrl, 
  safeDeleteOrphanedFile, 
  isFileOrphaned,
  deleteFile,
  isS3Configured
} = require('../utils/s3Storage');
const processImageSequence = require('../processImageSequence');
const logger = require('../utils/logger');

const cardLogger = logger.child({ component: 'cards' });
const fileLogger = logger.child({ component: 'card-files' });

// GET /api/cards - Get cards with pagination and filtering
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const search = req.query.search || '';
    const types = req.query.type ? (Array.isArray(req.query.type) ? req.query.type : [req.query.type]) : [];
    const tags = req.query.tag ? (Array.isArray(req.query.tag) ? req.query.tag : [req.query.tag]) : [];

    // Build the filter query
    const filter = {};
    
    if (search) {
      // Search in both description and tags
      filter.$or = [
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (types.length > 0) {
      filter.type = { $in: types };
    }
    
    if (tags.length > 0) {
      filter.tags = { $in: tags };
    }

    // Execute the query with pagination
    const cards = await Card.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    const totalCount = await Card.countDocuments(filter);

    // Convert storage paths to absolute URLs
    const baseUrl = getBaseUrl(req);
    const cardsWithUrls = cards.map(card => {
      const cardObj = card.toObject();
      
      // Convert all file paths to absolute URLs
      if (cardObj.preview) cardObj.preview = getFileUrl(cardObj.preview, baseUrl);
      if (cardObj.download) cardObj.download = getFileUrl(cardObj.download, baseUrl);
      if (cardObj.movie) cardObj.movie = getFileUrl(cardObj.movie, baseUrl);
      if (cardObj.transcript) cardObj.transcript = getFileUrl(cardObj.transcript, baseUrl);
      
      // Convert image sequence paths
      if (cardObj.imageSequence && Array.isArray(cardObj.imageSequence)) {
        cardObj.imageSequence = cardObj.imageSequence.map(img => getFileUrl(img, baseUrl));
      }
      
      return cardObj;
    });

    // Get all available tags for filtering
    const availableTags = await getAllTags();

    res.json({
      cards: cardsWithUrls,
      totalCount,
      availableTags
    });
  } catch (error) {
    cardLogger.error('Error fetching cards:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/cards/:id - Get single card by ID
router.get('/:id', async (req, res) => {
  try {
    const card = await Card.findById(req.params.id);
    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    // Convert storage paths to absolute URLs
    const baseUrl = getBaseUrl(req);
    const cardObj = card.toObject();
    
    // Convert all file paths to absolute URLs
    if (cardObj.preview) cardObj.preview = getFileUrl(cardObj.preview, baseUrl);
    if (cardObj.download) cardObj.download = getFileUrl(cardObj.download, baseUrl);
    if (cardObj.movie) cardObj.movie = getFileUrl(cardObj.movie, baseUrl);
    if (cardObj.transcript) cardObj.transcript = getFileUrl(cardObj.transcript, baseUrl);
    
    // Convert image sequence paths
    if (cardObj.imageSequence && Array.isArray(cardObj.imageSequence)) {
      cardObj.imageSequence = cardObj.imageSequence.map(img => getFileUrl(img, baseUrl));
    }

    res.json(cardObj);
  } catch (error) {
    cardLogger.error('Error fetching card:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/cards - Create new card
router.post('/', authMiddleware, handleCardUpload, async (req, res) => {
  try {
    cardLogger.info('Creating new card', { 
      type: req.body.type,
      hasFiles: !!req.files,
      fileFields: req.files ? Object.keys(req.files) : []
    });

    const { type, description, tags, date, instagramCopy, facebookCopy, imageSequenceCount } = req.body;

    // Log received files for debugging
    logReceivedFiles(req.files);

    // Validate required fields
    if (!type || !description) {
      return res.status(400).json({ error: 'Type and description are required' });
    }

    // Validate card type
    const typeValidation = validateCardType(type, req.files);
    if (!typeValidation.valid) {
      return res.status(400).json({ error: typeValidation.message });
    }

    // Parse tags from comma-separated string
    const tagsList = tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [];

    // Create card object
    const cardData = {
      type,
      description,
      tags: tagsList,
      fileMetadata: {
        date: date ? new Date(date) : new Date()
      }
    };

    // Add social copy fields if provided
    if (type === 'social' || type === 'reel') {
      if (instagramCopy) cardData.instagramCopy = instagramCopy;
      if (facebookCopy) cardData.facebookCopy = facebookCopy;
    }

    // Process preview image if provided
    if (req.files && req.files.preview) {
      const previewFile = req.files.preview[0];
      preserveOriginalFileName(req, previewFile, 'preview', cardData);
      
      const previewPath = await processFileAndGetPath(previewFile.path, 'preview');
      cardData.preview = previewPath;
      
      // Extract metadata
      const previewMetadata = await extractFileMetadata(previewFile, cardData.fileMetadata.date);
      Object.assign(cardData.fileMetadata, previewMetadata);
    }

    // Process download file for image cards
    if (type === 'image' && req.files && req.files.download) {
      const downloadFile = req.files.download[0];
      preserveOriginalFileName(req, downloadFile, 'download', cardData);
      
      const downloadPath = await processFileAndGetPath(downloadFile.path, 'download');
      cardData.download = downloadPath;
      
      // Use download file metadata if no preview
      if (!cardData.preview) {
        const downloadMetadata = await extractFileMetadata(downloadFile, cardData.fileMetadata.date);
        Object.assign(cardData.fileMetadata, downloadMetadata);
      }
    }

    // Process image sequence for social cards
    if (type === 'social') {
      const imageSequenceFiles = [];
      const sequenceCount = parseInt(imageSequenceCount) || 0;
      
      // Collect all image sequence files
      for (let i = 0; i < sequenceCount; i++) {
        const fieldName = `imageSequence_${i}`;
        if (req.files && req.files[fieldName] && req.files[fieldName].length > 0) {
          const file = req.files[fieldName][0];
          imageSequenceFiles.push(file);
          fileLogger.debug(`Found image sequence file ${i}: ${file.originalname}`);
        }
      }
      
      if (imageSequenceFiles.length === 0) {
        return res.status(400).json({ error: 'Social cards require at least one image in the sequence' });
      }
      
      // Process the image sequence
      try {
        const { imageSequencePaths, totalSequenceSize, fileSizes } = await processImageSequence(imageSequenceFiles);
        cardData.imageSequence = imageSequencePaths;
        cardData.fileMetadata.totalSequenceSize = totalSequenceSize;
        cardData.fileMetadata.imageSequenceCount = imageSequencePaths.length;
        cardData.fileMetadata.imageSequenceFileSizes = fileSizes;
        
        // Store original filenames
        cardData.fileMetadata.imageSequenceOriginalFileNames = imageSequenceFiles.map(f => f.originalname);
        
        // Use first image metadata if no preview
        if (!cardData.preview && imageSequenceFiles.length > 0) {
          const firstImageMetadata = await extractFileMetadata(imageSequenceFiles[0], cardData.fileMetadata.date);
          cardData.fileMetadata.width = firstImageMetadata.width;
          cardData.fileMetadata.height = firstImageMetadata.height;
        }
      } catch (error) {
        fileLogger.error('Error processing image sequence:', error);
        return res.status(500).json({ error: 'Failed to process image sequence' });
      }
    }

    // Process movie file for reel cards
    if (type === 'reel' && req.files && req.files.movie) {
      const movieFile = req.files.movie[0];
      preserveOriginalFileName(req, movieFile, 'movie', cardData);
      
      try {
        const { videoPath, previewPath } = await processVideoAndGeneratePreview(
          movieFile, 
          cardData.fileMetadata,
          type
        );
        
        cardData.movie = videoPath;
        
        // Use generated preview if no explicit preview was uploaded
        if (!cardData.preview && previewPath) {
          cardData.preview = previewPath;
          fileLogger.info('Using generated preview from video');
        }
      } catch (error) {
        fileLogger.error('Error processing video:', error);
        return res.status(500).json({ error: 'Failed to process video file' });
      }
    }

    // Process transcript file if provided
    if (req.files && req.files.transcript) {
      const transcriptFile = req.files.transcript[0];
      preserveOriginalFileName(req, transcriptFile, 'transcript', cardData);
      
      const transcriptPath = await processFileAndGetPath(transcriptFile.path, 'transcript');
      cardData.transcript = transcriptPath;
    }

    // Process tags
    if (tagsList.length > 0) {
      await processTags(tagsList);
    }

    // Create the card
    const newCard = await Card.create(cardData);
    cardLogger.info(`Card created successfully: ${newCard._id}`);

    // Convert storage paths to absolute URLs for response
    const baseUrl = getBaseUrl(req);
    const responseCard = newCard.toObject();
    
    if (responseCard.preview) responseCard.preview = getFileUrl(responseCard.preview, baseUrl);
    if (responseCard.download) responseCard.download = getFileUrl(responseCard.download, baseUrl);
    if (responseCard.movie) responseCard.movie = getFileUrl(responseCard.movie, baseUrl);
    if (responseCard.transcript) responseCard.transcript = getFileUrl(responseCard.transcript, baseUrl);
    if (responseCard.imageSequence && Array.isArray(responseCard.imageSequence)) {
      responseCard.imageSequence = responseCard.imageSequence.map(img => getFileUrl(img, baseUrl));
    }

    res.status(201).json(responseCard);
  } catch (error) {
    cardLogger.error('Error creating card:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/cards/:id - Update existing card
router.put('/:id', authMiddleware, handleCardUpload, async (req, res) => {
  try {
    const cardId = req.params.id;
    cardLogger.info(`Updating card ${cardId}`, { 
      hasFiles: !!req.files,
      fileFields: req.files ? Object.keys(req.files) : []
    });

    // Find the existing card
    const existingCard = await Card.findById(cardId);
    if (!existingCard) {
      return res.status(404).json({ error: 'Card not found' });
    }

    const { type, description, tags, date, instagramCopy, facebookCopy, imageSequenceCount } = req.body;

    // Log received files for debugging
    logReceivedFiles(req.files);

    // Parse tags from comma-separated string
    const tagsList = tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [];

    // Start with existing card data
    const updateData = {
      type: type || existingCard.type,
      description: description || existingCard.description,
      tags: tagsList.length > 0 ? tagsList : existingCard.tags,
      fileMetadata: { ...existingCard.fileMetadata }
    };

    // Update date if provided
    if (date) {
      updateData.fileMetadata.date = new Date(date);
    }

    // Update social copy fields
    if (type === 'social' || type === 'reel' || existingCard.type === 'social' || existingCard.type === 'reel') {
      if (instagramCopy !== undefined) updateData.instagramCopy = instagramCopy;
      if (facebookCopy !== undefined) updateData.facebookCopy = facebookCopy;
    }

    // Handle file removals
    if (req.body.remove_preview === 'true') {
      if (existingCard.preview) {
        await safeDeleteOrphanedFile(existingCard.preview, cardId, 'preview');
        updateData.preview = null;
      }
    }
    if (req.body.remove_download === 'true') {
      if (existingCard.download) {
        await safeDeleteOrphanedFile(existingCard.download, cardId, 'download');
        updateData.download = null;
      }
    }
    if (req.body.remove_movie === 'true') {
      if (existingCard.movie) {
        await safeDeleteOrphanedFile(existingCard.movie, cardId, 'movie');
        updateData.movie = null;
      }
    }
    if (req.body.remove_transcript === 'true') {
      if (existingCard.transcript) {
        await safeDeleteOrphanedFile(existingCard.transcript, cardId, 'transcript');
        updateData.transcript = null;
      }
    }

    // Process new file uploads
    if (req.files && req.files.preview) {
      const previewFile = req.files.preview[0];
      preserveOriginalFileName(req, previewFile, 'preview', updateData);
      
      // Delete old preview if it exists
      if (existingCard.preview) {
        await safeDeleteOrphanedFile(existingCard.preview, cardId, 'preview');
      }
      
      const previewPath = await processFileAndGetPath(previewFile.path, 'preview');
      updateData.preview = previewPath;
      
      // Extract metadata
      const previewMetadata = await extractFileMetadata(previewFile, updateData.fileMetadata.date);
      Object.assign(updateData.fileMetadata, previewMetadata);
    }

    if (req.files && req.files.download) {
      const downloadFile = req.files.download[0];
      preserveOriginalFileName(req, downloadFile, 'download', updateData);
      
      // Delete old download if it exists
      if (existingCard.download) {
        await safeDeleteOrphanedFile(existingCard.download, cardId, 'download');
      }
      
      const downloadPath = await processFileAndGetPath(downloadFile.path, 'download');
      updateData.download = downloadPath;
      
      // Update metadata
      const downloadMetadata = await extractFileMetadata(downloadFile, updateData.fileMetadata.date);
      Object.assign(updateData.fileMetadata, downloadMetadata);
    }

    if (req.files && req.files.movie) {
      const movieFile = req.files.movie[0];
      preserveOriginalFileName(req, movieFile, 'movie', updateData);
      
      // Delete old movie if it exists
      if (existingCard.movie) {
        await safeDeleteOrphanedFile(existingCard.movie, cardId, 'movie');
      }
      
      try {
        const { videoPath, previewPath } = await processVideoAndGeneratePreview(
          movieFile, 
          updateData.fileMetadata,
          updateData.type
        );
        
        updateData.movie = videoPath;
        
        // Update preview if generated and no explicit preview
        if (!req.files.preview && previewPath) {
          if (existingCard.preview) {
            await safeDeleteOrphanedFile(existingCard.preview, cardId, 'preview');
          }
          updateData.preview = previewPath;
          fileLogger.info('Updated with generated preview from video');
        }
      } catch (error) {
        fileLogger.error('Error processing updated video:', error);
        return res.status(500).json({ error: 'Failed to process video file' });
      }
    }

    if (req.files && req.files.transcript) {
      const transcriptFile = req.files.transcript[0];
      preserveOriginalFileName(req, transcriptFile, 'transcript', updateData);
      
      // Delete old transcript if it exists
      if (existingCard.transcript) {
        await safeDeleteOrphanedFile(existingCard.transcript, cardId, 'transcript');
      }
      
      const transcriptPath = await processFileAndGetPath(transcriptFile.path, 'transcript');
      updateData.transcript = transcriptPath;
    }

    // Handle image sequence updates for social cards
    if (updateData.type === 'social' && imageSequenceCount) {
      const imageSequenceFiles = [];
      const sequenceCount = parseInt(imageSequenceCount) || 0;
      
      // Collect all image sequence files
      for (let i = 0; i < sequenceCount; i++) {
        const fieldName = `imageSequence_${i}`;
        if (req.files && req.files[fieldName] && req.files[fieldName].length > 0) {
          const file = req.files[fieldName][0];
          imageSequenceFiles.push(file);
        }
      }
      
      if (imageSequenceFiles.length > 0) {
        // Delete old image sequence
        if (existingCard.imageSequence && Array.isArray(existingCard.imageSequence)) {
          for (const imagePath of existingCard.imageSequence) {
            await safeDeleteOrphanedFile(imagePath, cardId, 'imageSequence');
          }
        }
        
        // Process new image sequence
        try {
          const { imageSequencePaths, totalSequenceSize, fileSizes } = await processImageSequence(imageSequenceFiles);
          updateData.imageSequence = imageSequencePaths;
          updateData.fileMetadata.totalSequenceSize = totalSequenceSize;
          updateData.fileMetadata.imageSequenceCount = imageSequencePaths.length;
          updateData.fileMetadata.imageSequenceFileSizes = fileSizes;
          updateData.fileMetadata.imageSequenceOriginalFileNames = imageSequenceFiles.map(f => f.originalname);
        } catch (error) {
          fileLogger.error('Error processing updated image sequence:', error);
          return res.status(500).json({ error: 'Failed to process image sequence' });
        }
      }
    }

    // Generate preview for reel if requested
    if (req.body.generatePreview === 'true' && updateData.type === 'reel' && (updateData.movie || existingCard.movie)) {
      try {
        const moviePath = updateData.movie || existingCard.movie;
        
        // Delete old preview if it exists
        if (existingCard.preview) {
          await safeDeleteOrphanedFile(existingCard.preview, cardId, 'preview');
        }
        
        // Generate new preview
        const { previewPath } = await processVideoAndGeneratePreview(
          { path: moviePath }, 
          updateData.fileMetadata,
          updateData.type
        );
        
        if (previewPath) {
          updateData.preview = previewPath;
          fileLogger.info('Generated new preview from existing video');
        }
      } catch (error) {
        fileLogger.error('Error generating preview:', error);
        return res.status(500).json({ error: 'Failed to generate preview' });
      }
    }

    // Update tag counts
    await updateTagCounts(existingCard.tags, updateData.tags);

    // Update the card
    const updatedCard = await Card.findByIdAndUpdate(cardId, updateData, { new: true });
    cardLogger.info(`Card updated successfully: ${cardId}`);

    // Convert storage paths to absolute URLs for response
    const baseUrl = getBaseUrl(req);
    const responseCard = updatedCard.toObject();
    
    if (responseCard.preview) responseCard.preview = getFileUrl(responseCard.preview, baseUrl);
    if (responseCard.download) responseCard.download = getFileUrl(responseCard.download, baseUrl);
    if (responseCard.movie) responseCard.movie = getFileUrl(responseCard.movie, baseUrl);
    if (responseCard.transcript) responseCard.transcript = getFileUrl(responseCard.transcript, baseUrl);
    if (responseCard.imageSequence && Array.isArray(responseCard.imageSequence)) {
      responseCard.imageSequence = responseCard.imageSequence.map(img => getFileUrl(img, baseUrl));
    }

    res.json(responseCard);
  } catch (error) {
    cardLogger.error('Error updating card:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/cards/:id - Delete card
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const cardId = req.params.id;
    cardLogger.info(`Deleting card ${cardId}`);

    const card = await Card.findById(cardId);
    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    // Delete all associated files
    const filesToDelete = [];
    if (card.preview) filesToDelete.push(card.preview);
    if (card.download) filesToDelete.push(card.download);
    if (card.movie) filesToDelete.push(card.movie);
    if (card.transcript) filesToDelete.push(card.transcript);
    if (card.imageSequence && Array.isArray(card.imageSequence)) {
      filesToDelete.push(...card.imageSequence);
    }

    // Delete files that are not referenced by other cards
    for (const filePath of filesToDelete) {
      try {
        const isOrphaned = await isFileOrphaned(filePath, cardId);
        if (isOrphaned) {
          await deleteFile(filePath);
          fileLogger.info(`Deleted orphaned file: ${filePath}`);
        } else {
          fileLogger.info(`File still referenced by other cards: ${filePath}`);
        }
      } catch (error) {
        fileLogger.error(`Error deleting file ${filePath}:`, error);
      }
    }

    // Update tag counts
    await updateTagCounts(card.tags, []);

    // Delete the card
    await Card.findByIdAndDelete(cardId);
    cardLogger.info(`Card deleted successfully: ${cardId}`);

    res.status(204).end();
  } catch (error) {
    cardLogger.error('Error deleting card:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/cards/:id/social-copy - Update social copy only
router.patch('/:id/social-copy', authMiddleware, async (req, res) => {
  try {
    const cardId = req.params.id;
    const { instagramCopy, facebookCopy } = req.body;

    // Find the card
    const card = await Card.findById(cardId);
    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    // Only allow social copy updates for social and reel cards
    if (card.type !== 'social' && card.type !== 'reel') {
      return res.status(400).json({ error: 'Social copy can only be updated for social and reel cards' });
    }

    // Prepare update data
    const updateData = {};
    if (instagramCopy !== undefined) updateData.instagramCopy = instagramCopy;
    if (facebookCopy !== undefined) updateData.facebookCopy = facebookCopy;

    // Update the card
    const updatedCard = await Card.findByIdAndUpdate(cardId, updateData, { new: true });
    cardLogger.info(`Social copy updated for card: ${cardId}`);

    // Convert storage paths to absolute URLs for response
    const baseUrl = getBaseUrl(req);
    const responseCard = updatedCard.toObject();
    
    if (responseCard.preview) responseCard.preview = getFileUrl(responseCard.preview, baseUrl);
    if (responseCard.download) responseCard.download = getFileUrl(responseCard.download, baseUrl);
    if (responseCard.movie) responseCard.movie = getFileUrl(responseCard.movie, baseUrl);
    if (responseCard.transcript) responseCard.transcript = getFileUrl(responseCard.transcript, baseUrl);
    if (responseCard.imageSequence && Array.isArray(responseCard.imageSequence)) {
      responseCard.imageSequence = responseCard.imageSequence.map(img => getFileUrl(img, baseUrl));
    }

    res.json(responseCard);
  } catch (error) {
    cardLogger.error('Error updating social copy:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;