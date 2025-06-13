const express = require('express');
const router = express.Router();
const { Tag } = require('../models');
const logger = require('../utils/logger');

const tagLogger = logger.child({ component: 'tags' });

// Helper function to get all tags
const getAllTags = async () => {
  try {
    // Get all tags from the dedicated Tag collection
    const tags = await Tag.find({}).sort({ name: 1 });
    const tagNames = tags.map(tag => tag.name);
    return tagNames;
  } catch (error) {
    tagLogger.error('Error getting all tags:', error);
    return [];
  }
};

// Get all tags
router.get('/', async (req, res) => {
  try {
    const tags = await getAllTags();
    res.json(tags);
  } catch (error) {
    tagLogger.error('Error getting tags:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;