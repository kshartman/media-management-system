/**
 * Tags Migration Script
 * 
 * This script migrates tags from card documents to a separate Tag collection.
 * It should be run once after updating the server code to use the Tag model.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { connectToDatabase } = require('./db/connection');
const { Card, Tag } = require('./models');

async function migrateTagsToCollection() {
  try {
    console.log('Connecting to database...');
    await connectToDatabase();
    
    console.log('Connected to MongoDB. Starting tags migration...');
    
    // Clear existing tags
    await Tag.deleteMany({});
    console.log('Cleared existing Tag collection');
    
    // Get all cards
    const cards = await Card.find({});
    console.log(`Found ${cards.length} cards with tags to process`);
    
    // Create a map to track tag counts
    const tagCounts = new Map();
    
    // Count tags across all cards
    cards.forEach(card => {
      if (card.tags && Array.isArray(card.tags)) {
        card.tags.forEach(tag => {
          const trimmedTag = tag.trim();
          if (trimmedTag) {
            const currentCount = tagCounts.get(trimmedTag) || 0;
            tagCounts.set(trimmedTag, currentCount + 1);
          }
        });
      }
    });
    
    console.log(`Found ${tagCounts.size} unique tags`);
    
    // Create new Tag documents
    const tagPromises = Array.from(tagCounts.entries()).map(([name, count]) => {
      return Tag.create({ name, count });
    });
    
    await Promise.all(tagPromises);
    
    console.log('Tag migration completed successfully!');
    console.log('Tags in the system:');
    
    // Display all tags
    const tags = await Tag.find({}).sort({ name: 1 });
    tags.forEach(tag => {
      console.log(`- ${tag.name} (count: ${tag.count})`);
    });
    
    mongoose.connection.close();
    console.log('Database connection closed');
  } catch (error) {
    console.error('Error during tag migration:', error);
    try {
      mongoose.connection.close();
    } catch (e) {
      console.error('Error closing database connection:', e);
    }
    process.exit(1);
  }
}

migrateTagsToCollection();