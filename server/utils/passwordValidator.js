const crypto = require('crypto');

/**
 * Validates password strength
 * @param {string} password - The password to validate
 * @returns {Object} - Validation result with isValid boolean and errors array
 */
function validatePasswordStrength(password) {
  const errors = [];
  
  if (!password) {
    errors.push('Password is required');
    return { isValid: false, errors };
  }
  
  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  // Check for common weak passwords
  const commonPasswords = [
    'password', 'password123', 'admin', 'admin123', 'qwerty', 
    '123456', '123456789', 'password1', 'abc123', 'welcome',
    'letmein', 'monkey', 'dragon'
  ];
  
  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('Password cannot be a common password');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Generates a cryptographically secure password reset token
 * @returns {string} - Base64 URL-safe token
 */
function generateSecureToken() {
  // Generate 32 bytes (256 bits) of random data
  const buffer = crypto.randomBytes(32);
  // Convert to base64 URL-safe string
  return buffer.toString('base64url');
}

/**
 * Validates that a token has sufficient entropy
 * @param {string} token - The token to validate
 * @returns {boolean} - True if token is secure
 */
function validateTokenSecurity(token) {
  if (!token || token.length < 32) {
    return false;
  }
  
  // Check for sufficient character variety (basic entropy check)
  const uniqueChars = new Set(token.split('')).size;
  return uniqueChars >= 16; // Should have at least 16 different characters
}

module.exports = {
  validatePasswordStrength,
  generateSecureToken,
  validateTokenSecurity
};