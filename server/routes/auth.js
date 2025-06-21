const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User } = require('../models');
const { isEmailConfigured, sendPasswordResetEmail } = require('../utils/emailService');
const logger = require('../utils/logger');
const { scrypt, randomBytes } = require('crypto');
const { promisify } = require('util');
const { validatePasswordStrength, generateSecureToken } = require('../utils/passwordValidator');
const { authRateLimit, strictAuthRateLimit } = require('../middleware/rateLimiter');

const authLogger = logger.child({ component: 'auth' });

// Promisify scrypt and randomBytes
const scryptAsync = promisify(scrypt);
const randomBytesAsync = promisify(randomBytes);

const JWT_SECRET = process.env.JWT_SECRET;

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

// Secure setup endpoint - only available when no users exist
router.post('/setup', strictAuthRateLimit, async (req, res) => {
  try {
    // Check if any users already exist
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      authLogger.warn('Setup attempt when users already exist', { ip: req.ip });
      return res.status(403).json({ error: 'Setup not available. Users already exist.' });
    }
    
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }
    
    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ 
        error: 'Password does not meet security requirements',
        details: passwordValidation.errors
      });
    }
    
    // Validate email format
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    // Hash the password
    const hashedPassword = await hashPassword(password);
    
    // Create the admin user
    const adminUser = await User.create({
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: 'admin'
    });
    
    authLogger.info('First admin user created successfully', { username, email });
    
    // Generate JWT token
    const token = jwt.sign(
      {
        id: adminUser._id,
        username: adminUser.username,
        email: adminUser.email,
        role: adminUser.role
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Set secure httpOnly cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Only use HTTPS in production
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/'
    });
    
    res.status(201).json({
      message: 'Admin user created successfully',
      user: {
        id: adminUser._id,
        username: adminUser.username,
        email: adminUser.email,
        role: adminUser.role,
      },
    });
    
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key error
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ error: `${field} already exists` });
    }
    
    authLogger.error('Setup error:', error);
    res.status(500).json({ error: 'Server error during setup' });
  }
});

// Login endpoint
router.post('/login', authRateLimit, async (req, res) => {
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
      { expiresIn: '24h' }
    );

    // Set secure httpOnly cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Only use HTTPS in production
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/'
    });
    
    res.json({
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
router.post('/forgot-password', authRateLimit, async (req, res) => {
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

    // Generate secure reset token
    const resetToken = generateSecureToken();
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Set token and expiration (1 hour from now)
    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    // Send reset email
    try {
      await sendPasswordResetEmail(user.email, resetToken, user.username, '1');
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
router.post('/reset-password', authRateLimit, async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ 
        error: 'Password does not meet security requirements',
        details: passwordValidation.errors
      });
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

// Get current user endpoint (for session validation)
router.get('/me', (req, res) => {
  try {
    // Try to get token from cookie
    const token = req.cookies?.auth_token;
    
    if (!token) {
      return res.status(401).json({ error: 'No session found' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    res.json({
      user: {
        id: decoded.id,
        username: decoded.username,
        email: decoded.email,
        role: decoded.role,
      },
    });
  } catch (error) {
    // Clear invalid cookie
    res.clearCookie('auth_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });
    
    res.status(401).json({ error: 'Invalid session' });
  }
});

// Logout endpoint
router.post('/logout', (req, res) => {
  // Clear the auth cookie
  res.clearCookie('auth_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  });
  
  authLogger.info('User logged out', { ip: req.ip });
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;