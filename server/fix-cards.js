require('dotenv').config();
const mongoose = require('mongoose');
const { connectToDatabase } = require('./db/connection');
const { Card } = require('./models');

async function main() {
  try {
    await connectToDatabase();
    
    // Check for existing Blue Logo card
    const existingCard = await Card.findOne({description: /ZIVE Blue Logo/i});
    
    if (existingCard) {
      console.log('ZIVE Blue Logo already exists:', existingCard._id);
      if (existingCard.type !== 'image') {
        console.log('Updating type from', existingCard.type, 'to image');
        existingCard.type = 'image';
        await existingCard.save();
        console.log('Updated successfully');
      }
    } else {
      // Create a new image card for ZIVE Blue Logo
      const blueLogoCard = new Card({
        type: 'image',
        description: 'ZIVE Blue Logo',
        tags: ['logo', 'branding'],
        download: '/uploads/1746863024641-ZIVE-logo_Blue.png'
      });
      await blueLogoCard.save();
      console.log('Created new ZIVE Blue Logo card:', blueLogoCard._id);
    }
    
    // Check for any incorrectly typed cards
    const allCards = await Card.find();
    let updatedCount = 0;
    
    for (const card of allCards) {
      let needsUpdate = false;
      let newType = card.type;
      
      // Check if card has the right type based on its fields
      if (card.documentCopy && card.type !== 'social') {
        console.log(`Card ${card._id} has documentCopy but type is ${card.type}, fixing to social`);
        newType = 'social';
        needsUpdate = true;
      } else if (card.movie && card.transcript && card.type !== 'reel') {
        console.log(`Card ${card._id} has movie/transcript but type is ${card.type}, fixing to reel`);
        newType = 'reel';
        needsUpdate = true;
      } else if (card.download && !card.documentCopy && !card.movie && !card.transcript && card.type !== 'image') {
        console.log(`Card ${card._id} has download but type is ${card.type}, fixing to image`);
        newType = 'image';
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        card.type = newType;
        await card.save();
        updatedCount++;
      }
    }
    
    console.log(`Total cards updated: ${updatedCount}`);
    
    mongoose.connection.close();
  } catch (err) {
    console.error(err);
    mongoose.connection.close();
  }
}

main();