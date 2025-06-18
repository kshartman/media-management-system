/**
 * Mail System Entry Point
 * Exports the main mail service and utilities
 */

const MailService = require('./MailService');
const MailFactory = require('./MailFactory');
const MailInterface = require('./MailInterface');

module.exports = {
  // Main service (singleton)
  mailService: MailService,
  
  // Factory for creating drivers
  MailFactory,
  
  // Base interface for creating custom drivers
  MailInterface,
  
  // Convenience methods
  isEmailConfigured: () => MailService.isConfigured(),
  sendWelcomeEmail: (to, resetToken, username) => MailService.sendWelcomeEmail(to, resetToken, username),
  sendPasswordResetEmail: (to, resetToken, username) => MailService.sendPasswordResetEmail(to, resetToken, username),
  getMailStatus: () => MailService.getStatus()
};