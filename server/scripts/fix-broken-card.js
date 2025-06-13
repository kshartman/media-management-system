require('dotenv').config();
const mongoose = require('mongoose');
const { connectToDatabase } = require('../db/connection');
const { Card } = require('../models');

async function fixBrokenCard() {
  try {
    await connectToDatabase();
    console.log('Connected to database successfully');
    
    const cardId = '684a7b233e99c1f8036dadca';
    console.log(`Looking for card with ID: ${cardId}`);
    
    // Find the specific broken card
    const card = await Card.findById(cardId);
    
    if (!card) {
      console.log('Card not found with the specified ID');
      return;
    }
    
    console.log('Found card:');
    console.log('- Type:', card.type);
    console.log('- Current description:', card.description);
    console.log('- Tags:', card.tags);
    console.log('- Preview:', card.preview || 'No preview');
    console.log('- Movie:', card.movie || 'No movie');
    console.log('- Has transcript:', !!card.transcript);
    
    let needsUpdate = false;
    
    // Clean up the description if it contains system note text
    const originalDescription = card.description;
    let cleanDescription = originalDescription;
    
    // Remove common system note patterns
    const systemNotePatterns = [
      /\[System note:.*?\]/gi,
      /\(System note:.*?\)/gi,
      /System note:.*$/gmi,
      /Note:.*failed.*preview.*frame/gi,
      /Failed to extract.*preview.*frame/gi,
      /Error.*preview.*extraction/gi,
      /\[Error:.*?\]/gi,
      /\(Error:.*?\)/gi,
      /Upload.*failed/gi,
      /Re-upload.*failed/gi,
      /Processing.*error/gi
    ];
    
    for (const pattern of systemNotePatterns) {
      cleanDescription = cleanDescription.replace(pattern, '').trim();
    }
    
    // Remove extra whitespace and newlines
    cleanDescription = cleanDescription.replace(/\s+/g, ' ').trim();
    
    // If description is now empty or too short, set a proper default
    if (!cleanDescription || cleanDescription.length < 10) {
      cleanDescription = 'What is NSF certification and why is it so important for Zive 7?';
      console.log('Description was empty or too short, setting default NSF certification description');
    }
    
    // Update description if it was cleaned
    if (cleanDescription !== originalDescription) {
      card.description = cleanDescription;
      needsUpdate = true;
      console.log('Updated description from:');
      console.log(`  "${originalDescription}"`);
      console.log('To:');
      console.log(`  "${cleanDescription}"`);
    }
    
    // Check and fix preview issues
    if (card.type === 'reel' && card.movie) {
      console.log('This is a reel card with a movie file');
      
      // Check if preview exists and is accessible
      if (!card.preview) {
        console.log('No preview image found - this may cause display issues');
        console.log('The card will show a gray play button area without a preview');
        
        // We could try to regenerate the preview here, but for now just log it
        console.log('Consider re-processing the video to generate a preview image');
      } else {
        console.log('Preview image exists:', card.preview);
      }
    }
    
    // Ensure proper tags for NSF certification content
    if (cleanDescription.toLowerCase().includes('nsf') && 
        cleanDescription.toLowerCase().includes('certification')) {
      
      const currentTags = card.tags || [];
      const suggestedTags = ['nsf', 'certification', 'zive', 'quality'];
      
      let tagsToAdd = [];
      for (const tag of suggestedTags) {
        if (!currentTags.some(t => t.toLowerCase() === tag.toLowerCase())) {
          tagsToAdd.push(tag);
        }
      }
      
      if (tagsToAdd.length > 0) {
        card.tags = [...currentTags, ...tagsToAdd];
        needsUpdate = true;
        console.log('Added relevant tags:', tagsToAdd);
      }
    }
    
    // Save changes if any were made
    if (needsUpdate) {
      await card.save();
      console.log('Card updated successfully!');
    } else {
      console.log('No changes needed - card is already in good condition');
    }
    
    // Final status report
    console.log('\n=== FINAL CARD STATUS ===');
    console.log('ID:', card._id);
    console.log('Type:', card.type);
    console.log('Description:', card.description);
    console.log('Tags:', card.tags);
    console.log('Preview:', card.preview || '[No preview - may show gray play button]');
    console.log('Movie file:', card.movie || '[No movie file]');
    console.log('Has transcript:', !!card.transcript);
    
    if (card.type === 'reel' && !card.preview) {
      console.log('\n⚠️  WARNING: This reel card has no preview image.');
      console.log('   This will cause the card to display with just a gray play button area.');
      console.log('   To fix this completely, you may need to re-upload the video');
      console.log('   or manually generate a preview frame from the video file.');
    } else {
      console.log('\n✅ Card should now display properly!');
    }
    
    mongoose.connection.close();
    
  } catch (error) {
    console.error('Error fixing card:', error);
    mongoose.connection.close();
    process.exit(1);
  }
}

// Run the fix
console.log('Starting broken card fix script...');
fixBrokenCard();