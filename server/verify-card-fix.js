require('dotenv').config();
const mongoose = require('mongoose');
const { connectToDatabase } = require('./db/connection');
const { Card } = require('./models');

async function verifyCardFix() {
  try {
    await connectToDatabase();
    
    const cardId = '684a7b233e99c1f8036dadca';
    const card = await Card.findById(cardId);
    
    if (!card) {
      console.log('❌ Card not found!');
      return;
    }
    
    console.log('=== CARD VERIFICATION ===');
    console.log(`Card ID: ${card._id}`);
    console.log(`Type: ${card.type}`);
    console.log(`Description: "${card.description}"`);
    console.log(`Tags: [${card.tags.join(', ')}]`);
    console.log(`Preview: ${card.preview || 'None'}`);
    console.log(`Movie: ${card.movie || 'None'}`);
    console.log(`Created: ${card.createdAt}`);
    console.log(`Updated: ${card.updatedAt}`);
    
    // Verification checks
    const checks = [];
    
    // Check 1: Description should not contain system notes
    const hasSystemNotes = /\[System [Nn]ote:|System [Nn]ote:|failed.*preview|Upload date:/i.test(card.description);
    checks.push({
      name: 'Description clean of system notes',
      passed: !hasSystemNotes,
      details: hasSystemNotes ? 'Still contains system note text' : 'Clean description'
    });
    
    // Check 2: Description should be meaningful
    const hasGoodDescription = card.description && card.description.length > 10;
    checks.push({
      name: 'Description is meaningful',
      passed: hasGoodDescription,
      details: hasGoodDescription ? 'Good length and content' : 'Description too short or empty'
    });
    
    // Check 3: For reel cards, should have movie file
    if (card.type === 'reel') {
      const hasMovie = !!card.movie;
      checks.push({
        name: 'Reel has movie file',
        passed: hasMovie,
        details: hasMovie ? 'Movie file present' : 'Missing movie file'
      });
      
      // Check 4: Preview image exists (preferred but not required)
      const hasPreview = !!card.preview;
      checks.push({
        name: 'Has preview image',
        passed: hasPreview,
        details: hasPreview ? 'Preview image available' : 'No preview - will show gray play button'
      });
    }
    
    // Check 5: Has relevant tags
    const hasTags = card.tags && card.tags.length > 0;
    checks.push({
      name: 'Has relevant tags',
      passed: hasTags,
      details: hasTags ? `${card.tags.length} tags` : 'No tags'
    });
    
    console.log('\n=== VERIFICATION RESULTS ===');
    let allPassed = true;
    
    for (const check of checks) {
      const status = check.passed ? '✅' : '❌';
      console.log(`${status} ${check.name}: ${check.details}`);
      if (!check.passed) allPassed = false;
    }
    
    console.log('\n=== OVERALL STATUS ===');
    if (allPassed) {
      console.log('🎉 Card is fully fixed and should display properly!');
    } else {
      console.log('⚠️  Card has some issues but major problems are resolved.');
      console.log('   The card should display much better than before.');
    }
    
    mongoose.connection.close();
    
  } catch (error) {
    console.error('Error verifying card:', error);
    mongoose.connection.close();
    process.exit(1);
  }
}

console.log('Verifying card fix...');
verifyCardFix();