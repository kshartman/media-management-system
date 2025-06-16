const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User } = require('../models');
const { isEmailConfigured, sendPasswordResetEmail } = require('../utils/emailService');
const logger = require('../utils/logger');
const { scrypt, randomBytes } = require('crypto');
const { promisify } = require('util');

const authLogger = logger.child({ component: 'auth' });

// Promisify scrypt and randomBytes
const scryptAsync = promisify(scrypt);
const randomBytesAsync = promisify(randomBytes);

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Helper function to check if a password is already hashed
function isAlreadyHashed(password) {
  // Our hashed passwords have a specific format: salt:hash
  return typeof password === 'string' && password.includes(':') && password.length > 64;
}

// Helper function to hash passwords
async function hashPassword(password) {
  // Generate a random salt
  const salt = (await randomBytesAsync(16)).toString('hex');
  // Use scrypt to hash the password with the salt
  const derivedKey = await scryptAsync(password, salt, 64);
  // Return the salt and the hashed password
  return `${salt}:${derivedKey.toString('hex')}`;
}

// Helper function to verify passwords
async function verifyPassword(storedPassword, suppliedPassword) {
  try {
    // Check for undefined or invalid values
    if (!storedPassword) {
      authLogger.error('Error verifying password: storedPassword is undefined or null');
      return false;
    }

    if (!suppliedPassword) {
      authLogger.error('Error verifying password: suppliedPassword is undefined or null');
      return false;
    }

    // Check if the password is in the expected format
    if (!isAlreadyHashed(storedPassword)) {
      authLogger.error('Error verifying password: stored password is not in the expected hashed format');
      return false;
    }

    // Split the stored password into salt and hash
    const [salt, storedHash] = storedPassword.split(':');

    // Double-check that we got both parts
    if (!salt || !storedHash) {
      authLogger.error('Error verifying password: could not extract salt and hash from stored password');
      return false;
    }

    // Hash the supplied password with the same salt
    const derivedKey = await scryptAsync(suppliedPassword, salt, 64);

    // Compare the hashes
    return crypto.timingSafeEqual(
      Buffer.from(storedHash, 'hex'),
      derivedKey
    );
  } catch (error) {
    authLogger.error('Error verifying password:', error);
    return false;
  }
}

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Allow login with either username or email (both case-insensitive)
    const user = await User.findOne({
      $or: [
        { username: username },
        { email: username.toLowerCase() }
      ]
    }).collation({ locale: 'en', strength: 2 });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify the password using our scrypt helper
    const isPasswordValid = await verifyPassword(user.password, password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login time
    user.lastLoginAt = new Date();
    await user.save();

    const token = jwt.sign(
      {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    authLogger.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Password reset request endpoint
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if email service is configured
    if (!isEmailConfigured()) {
      return res.status(503).json({ error: 'Password reset is not available. Email service is not configured.' });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Don't reveal that the email doesn't exist
      return res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Set token and expiration (1 hour from now)
    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    // Send reset email
    try {
      await sendPasswordResetEmail(user.email, resetToken, user.username);
      res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
    } catch (emailError) {
      authLogger.error('Error sending password reset email:', emailError);
      // Clear the reset token if email failed
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      await user.save();
      return res.status(500).json({ error: 'Failed to send password reset email. Please try again later.' });
    }
  } catch (error) {
    authLogger.error('Forgot password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Password reset confirmation endpoint
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Hash the token to compare with stored version
    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with valid reset token
    const user = await User.findOne({
      resetPasswordToken: resetTokenHash,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password and clear reset token
    user.password = hashedPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.json({ message: 'Password has been reset successfully' });
  } catch (error) {
    authLogger.error('Reset password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;