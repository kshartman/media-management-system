require('dotenv').config();
const mongoose = require('mongoose');
const { connectToDatabase } = require('../db/connection');
const { Card } = require('../models');

async function fixAllBrokenCards() {
  try {
    await connectToDatabase();
    console.log('Connected to database successfully');
    
    // Find all cards that might have system notes in their descriptions
    const allCards = await Card.find();
    console.log(`Found ${allCards.length} total cards to check`);
    
    let fixedCards = 0;
    let cardsWithIssues = 0;
    
    // System note patterns to clean up
    const systemNotePatterns = [
      /\[System note:.*?\]/gi,
      /\(System note:.*?\)/gi,
      /System note:.*$/gmi,
      /\[System Note:.*?\]/gi,
      /\(System Note:.*?\)/gi,
      /System Note:.*$/gmi,
      /Note:.*failed.*preview.*frame/gi,
      /Failed to extract.*preview.*frame/gi,
      /Error.*preview.*extraction/gi,
      /\[Error:.*?\]/gi,
      /\(Error:.*?\)/gi,
      /Upload.*failed/gi,
      /Re-upload.*failed/gi,
      /Processing.*error/gi,
      /Video file was missing.*Upload date:.*$/gmi
    ];
    
    for (const card of allCards) {
      let needsUpdate = false;
      let issues = [];
      
      // Check for system notes in description
      const originalDescription = card.description;
      let cleanDescription = originalDescription;
      
      // Clean up system note patterns
      for (const pattern of systemNotePatterns) {
        if (pattern.test(cleanDescription)) {
          cleanDescription = cleanDescription.replace(pattern, '').trim();
          issues.push('Had system note text in description');
        }
      }
      
      // Remove extra whitespace and newlines
      cleanDescription = cleanDescription.replace(/\s+/g, ' ').trim();
      
      // Check if description became empty or too short
      if (!cleanDescription || cleanDescription.length < 5) {
        // Try to generate a reasonable description based on tags or filename
        if (card.tags && card.tags.length > 0) {
          cleanDescription = `Content about ${card.tags.join(', ')}`;
        } else if (card.fileMetadata && card.fileMetadata.originalFileName) {
          const baseName = card.fileMetadata.originalFileName.replace(/\.[^.]+$/, '');
          cleanDescription = baseName.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        } else {
          cleanDescription = 'Media content';
        }
        issues.push('Description was empty, generated default');
      }
      
      // Update description if it was cleaned
      if (cleanDescription !== originalDescription) {
        card.description = cleanDescription;
        needsUpdate = true;
      }
      
      // Check for preview issues in reel cards
      if (card.type === 'reel') {
        if (!card.preview && card.movie) {
          issues.push('Reel card missing preview image');
        }
        if (!card.movie) {
          issues.push('Reel card missing movie file');
        }
      }
      
      // Check for missing required files
      if (card.type === 'image' && !card.download) {
        issues.push('Image card missing download file');
      }
      
      if (card.type === 'social' && (!card.imageSequence || card.imageSequence.length === 0)) {
        issues.push('Social card missing image sequence');
      }
      
      // Report and fix issues
      if (issues.length > 0) {
        cardsWithIssues++;
        console.log(`\nCard ${card._id} (${card.type}):`);
        console.log(`  Issues: ${issues.join(', ')}`);
        
        if (originalDescription !== cleanDescription) {
          console.log(`  Description cleaned: "${originalDescription.substring(0, 100)}..." -> "${cleanDescription}"`);
        }
      }
      
      // Save changes if any were made
      if (needsUpdate) {
        await card.save();
        fixedCards++;
      }
    }
    
    console.log('\n=== SUMMARY ===');
    console.log(`Total cards checked: ${allCards.length}`);
    console.log(`Cards with issues found: ${cardsWithIssues}`);
    console.log(`Cards fixed: ${fixedCards}`);
    
    if (fixedCards > 0) {
      console.log('\n✅ Fixed cards should now display properly!');
    } else {
      console.log('\n✅ No cards needed fixing - all are in good condition!');
    }
    
    mongoose.connection.close();
    
  } catch (error) {
    console.error('Error fixing cards:', error);
    mongoose.connection.close();
    process.exit(1);
  }
}

// Option to run for a specific card ID
async function fixSpecificCard(cardId) {
  try {
    await connectToDatabase();
    console.log('Connected to database successfully');
    console.log(`Looking for card with ID: ${cardId}`);
    
    const card = await Card.findById(cardId);
    
    if (!card) {
      console.log('Card not found with the specified ID');
      return;
    }
    
    console.log('\nBefore fixing:');
    console.log('- Description:', card.description);
    console.log('- Type:', card.type);
    console.log('- Preview:', card.preview || 'None');
    
    // Same fixing logic as above but for one card
    // ... (implement if needed)
    
    mongoose.connection.close();
    
  } catch (error) {
    console.error('Error fixing specific card:', error);
    mongoose.connection.close();
    process.exit(1);
  }
}

// Check command line arguments
const args = process.argv.slice(2);
if (args.length > 0 && args[0]) {
  console.log(`Starting fix for specific card: ${args[0]}`);
  fixSpecificCard(args[0]);
} else {
  console.log('Starting comprehensive card fix script...');
  fixAllBrokenCards();
}