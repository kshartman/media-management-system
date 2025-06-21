const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { User } = require('../models');
const authMiddleware = require('../middleware/auth');
const { isEmailConfigured, sendWelcomeEmail, sendPasswordResetEmail } = require('../utils/emailService');
const logger = require('../utils/logger');
const { scrypt, randomBytes } = require('crypto');
const { promisify } = require('util');

const userLogger = logger.child({ component: 'users' });

// Promisify scrypt
const scryptAsync = promisify(scrypt);
const randomBytesAsync = promisify(randomBytes);

// Helper function to hash passwords
async function hashPassword(password) {
  // Generate a random salt
  const salt = (await randomBytesAsync(16)).toString('hex');
  // Use scrypt to hash the password with the salt
  const derivedKey = await scryptAsync(password, salt, 64);
  // Return the salt and the hashed password
  return `${salt}:${derivedKey.toString('hex')}`;
}

// Get all users (admin only)
router.get('/', authMiddleware, async (req, res) => {
  try {
    // Check if the requesting user is an admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
    }

    // Fetch all users (excluding passwords)
    const users = await User.find({}, { password: 0 });
    res.json(users);
  } catch (error) {
    userLogger.error('Error fetching users:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get a single user by ID (admin only)
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    // Check if the requesting user is an admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
    }

    const user = await User.findById(req.params.id, { password: 0 });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    userLogger.error('Error fetching user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a new user (admin only)
router.post('/', authMiddleware, async (req, res) => {
  try {
    // Check if the requesting user is an admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
    }

    const { username, email, role } = req.body;

    // Validate required fields
    if (!username || !email) {
      return res.status(400).json({ error: 'Username and email are required' });
    }

    // Check if username or email already exists (case-insensitive)
    const existingUser = await User.findOne({
      $or: [{ username }, { email: email.toLowerCase() }]
    }).collation({ locale: 'en', strength: 2 });

    if (existingUser) {
      return res.status(400).json({
        error: 'Username or email already in use'
      });
    }

    // Create the user with a temporary password (they'll set their real password via email)
    const tempPassword = crypto.randomBytes(32).toString('hex');
    const hashedPassword = await hashPassword(tempPassword);

    // Generate reset token for welcome email
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Create the user
    const newUser = await User.create({
      username,
      email,
      password: hashedPassword, // Temporary password
      role: role || 'editor', // Default to 'editor' role if not specified
      resetPasswordToken: resetTokenHash,
      resetPasswordExpires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    });

    // Send welcome email with password setup link if email service is configured
    if (isEmailConfigured()) {
      try {
        await sendWelcomeEmail(email, resetToken, username, '24');
        userLogger.info(`Welcome email sent to new user: ${username} (${email})`);
      } catch (emailError) {
        userLogger.error('Error sending welcome email:', emailError);
        // Don't fail user creation if email fails, but log the error
      }
    } else {
      userLogger.info(`User ${username} created but welcome email not sent (email service not configured)`);
    }

    // Return the user without the password
    const userResponse = newUser.toObject();
    delete userResponse.password;
    delete userResponse.resetPasswordToken; // Don't expose the token

    res.status(201).json({
      ...userResponse,
      message: isEmailConfigured() 
        ? 'User created successfully. A welcome email has been sent with password setup instructions.'
        : 'User created successfully. Email service is not configured, so no welcome email was sent.'
    });
  } catch (error) {
    userLogger.error('Error creating user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update a user (admin only)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    // Check if the requesting user is an admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
    }

    const userId = req.params.id;
    const { username, email, password, role } = req.body;

    // Find the user to update
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if username or email already exists (excluding the current user, case-insensitive)
    if (username || email) {
      const existingUser = await User.findOne({
        _id: { $ne: userId },
        $or: [
          ...(username ? [{ username }] : []),
          ...(email ? [{ email: email.toLowerCase() }] : [])
        ]
      }).collation({ locale: 'en', strength: 2 });

      if (existingUser) {
        return res.status(400).json({
          error: 'Username or email already in use'
        });
      }
    }

    // Prepare update object
    const updateData = {};
    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (password) {
      updateData.password = await hashPassword(password);
    }

    // Update the user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, select: '-password' }
    );

    res.json(updatedUser);
  } catch (error) {
    userLogger.error('Error updating user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a user (admin only)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    // Check if the requesting user is an admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
    }

    const userId = req.params.id;

    // Don't allow deleting the last admin user
    const adminCount = await User.countDocuments({ role: 'admin' });
    const userToDelete = await User.findById(userId);

    if (!userToDelete) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (userToDelete.role === 'admin' && adminCount <= 1) {
      return res.status(400).json({
        error: 'Cannot delete the last admin user'
      });
    }

    // Delete the user
    await User.findByIdAndDelete(userId);

    res.status(204).end();
  } catch (error) {
    userLogger.error('Error deleting user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Send password reset link to a user (admin only)
router.post('/:id/send-reset-link', authMiddleware, async (req, res) => {
  try {
    // Check if the requesting user is an admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
    }

    // Check if email service is configured
    if (!isEmailConfigured()) {
      return res.status(503).json({ error: 'Password reset is not available. Email service is not configured.' });
    }

    const userId = req.params.id;
    
    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Set token and expiration (8 hours from now)
    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours
    await user.save();

    // Send reset email
    try {
      await sendPasswordResetEmail(user.email, resetToken, user.username, '8');
      userLogger.info(`Password reset link sent to user: ${user.username} (${user.email}) by admin: ${req.user.username}`);
      res.json({ 
        message: 'Password reset link has been sent successfully',
        email: user.email,
        expiresAt: user.resetPasswordExpires
      });
    } catch (emailError) {
      userLogger.error('Error sending password reset email:', emailError);
      // Clear the reset token if email failed
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      await user.save();
      return res.status(500).json({ error: 'Failed to send password reset email. Please try again later.' });
    }
  } catch (error) {
    userLogger.error('Admin send reset link error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;