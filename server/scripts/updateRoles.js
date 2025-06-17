const mongoose = require('mongoose');
const { User } = require('../models');
require('dotenv').config();

async function updateRoles() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: process.env.MONGODB_DB_NAME || 'media-management'
    });
    
    console.log('Connected to MongoDB');
    
    // Update all users with role 'user' to 'editor'
    const result = await User.updateMany(
      { role: 'user' },
      { $set: { role: 'editor' } }
    );
    
    console.log(`Updated ${result.modifiedCount} users from role 'user' to 'editor'`);
    
    // Show current users and their roles
    const users = await User.find({}, 'username email role');
    console.log('\nCurrent users:');
    users.forEach(user => {
      console.log(`- ${user.username} (${user.email}): ${user.role}`);
    });
    
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  } catch (error) {
    console.error('Error updating roles:', error);
    process.exit(1);
  }
}

updateRoles();