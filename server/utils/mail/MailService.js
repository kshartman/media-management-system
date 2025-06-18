const MailFactory = require('./MailFactory');
const logger = require('../logger');

const mailServiceLogger = logger.child({ service: 'mailService' });

/**
 * Mail Service
 * High-level service for sending emails using the configured mail driver
 */
class MailService {
  constructor() {
    this.driver = null;
    this.initialized = false;
  }

  /**
   * Initialize the mail service
   * @param {string} [driverName] - Specific driver to use (optional)
   */
  init(driverName = null) {
    try {
      this.driver = MailFactory.createDriver(driverName);
      this.initialized = true;
      mailServiceLogger.info(`Mail service initialized with ${this.driver.getDriverName()} driver`);
    } catch (error) {
      mailServiceLogger.error('Failed to initialize mail service', error);
      throw error;
    }
  }

  /**
   * Check if the mail service is configured and ready
   * @returns {boolean}
   */
  isConfigured() {
    if (!this.initialized) {
      try {
        this.init();
      } catch (error) {
        return false;
      }
    }
    return this.driver && this.driver.isConfigured();
  }

  /**
   * Send an email
   * @param {Object} options - Email options
   * @param {string} options.to - Recipient email address
   * @param {string} [options.from] - Sender email address
   * @param {string} options.subject - Email subject
   * @param {string} options.html - HTML content
   * @param {string} options.text - Plain text content
   * @param {Array} [options.attachments] - Optional attachments
   * @returns {Promise<void>}
   */
  async send(options) {
    if (!this.isConfigured()) {
      throw new Error('Mail service is not configured');
    }

    return await this.driver.send(options);
  }

  /**
   * Send a welcome email with password setup link
   * @param {string} to - Recipient email address
   * @param {string} resetToken - Password reset token
   * @param {string} username - Username
   * @returns {Promise<void>}
   */
  async sendWelcomeEmail(to, resetToken, username) {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    
    const options = {
      to,
      subject: 'Welcome to Media Management System - Set Your Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to Media Management System!</h2>
          <p>Hello ${username},</p>
          <p>Your account has been created successfully. To get started, you'll need to set up your password.</p>
          <p>Click the button below to set your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
              Set Your Password
            </a>
          </div>
          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p style="word-break: break-all;">${resetUrl}</p>
          <p>This link will expire in 1 hour for security reasons.</p>
          <p>Once you've set your password, you'll be able to access the Media Management System.</p>
          <hr style="margin: 30px 0;">
          <p style="color: #666; font-size: 12px;">Media Management System</p>
        </div>
      `,
      text: `
        Welcome to Media Management System!
        
        Hello ${username},
        
        Your account has been created successfully. To get started, you'll need to set up your password.
        
        Please visit the following link to set your password:
        
        ${resetUrl}
        
        This link will expire in 1 hour for security reasons.
        
        Once you've set your password, you'll be able to access the Media Management System.
        
        Media Management System
      `
    };

    await this.send(options);
    mailServiceLogger.info(`Welcome email sent to ${to}`);
  }

  /**
   * Send a password reset email
   * @param {string} to - Recipient email address
   * @param {string} resetToken - Password reset token
   * @param {string} username - Username
   * @returns {Promise<void>}
   */
  async sendPasswordResetEmail(to, resetToken, username) {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    
    const options = {
      to,
      subject: 'Password Reset Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Request</h2>
          <p>Hello ${username},</p>
          <p>You have requested to reset your password. Click the button below to reset your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p style="word-break: break-all;">${resetUrl}</p>
          <p>This link will expire in 1 hour for security reasons.</p>
          <p>If you didn't request this password reset, please ignore this email.</p>
          <hr style="margin: 30px 0;">
          <p style="color: #666; font-size: 12px;">Media Management System</p>
        </div>
      `,
      text: `
        Password Reset Request
        
        Hello ${username},
        
        You have requested to reset your password. Please visit the following link to reset your password:
        
        ${resetUrl}
        
        This link will expire in 1 hour for security reasons.
        
        If you didn't request this password reset, please ignore this email.
        
        Media Management System
      `
    };

    await this.send(options);
    mailServiceLogger.info(`Password reset email sent to ${to}`);
  }

  /**
   * Get the current driver name
   * @returns {string|null}
   */
  getDriverName() {
    return this.driver ? this.driver.getDriverName() : null;
  }

  /**
   * Get driver status information
   * @returns {Object}
   */
  getStatus() {
    return {
      initialized: this.initialized,
      configured: this.isConfigured(),
      currentDriver: this.getDriverName(),
      availableDrivers: MailFactory.getAvailableDrivers(),
      driverStatus: MailFactory.getDriverStatus()
    };
  }
}

// Create a singleton instance
const mailService = new MailService();

module.exports = mailService;