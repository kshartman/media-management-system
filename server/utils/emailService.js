/**
 * Email Service - Legacy Compatibility Layer
 * 
 * This file maintains backward compatibility with the existing API
 * while using the new abstracted mail system underneath.
 * 
 * For new code, prefer using the mail system directly:
 * const { mailService } = require('./mail');
 */

const { 
  mailService, 
  isEmailConfigured, 
  sendWelcomeEmail, 
  sendPasswordResetEmail 
} = require('./mail');

module.exports = {
  isEmailConfigured,
  sendPasswordResetEmail,
  sendWelcomeEmail
};