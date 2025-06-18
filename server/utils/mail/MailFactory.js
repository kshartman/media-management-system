const SendGridDriver = require('./SendGridDriver');
const MailgunDriver = require('./MailgunDriver');
const logger = require('../logger');

const mailFactoryLogger = logger.child({ service: 'mailFactory' });

/**
 * Mail Factory
 * Creates and configures mail drivers based on environment configuration
 */
class MailFactory {
  /**
   * Create a mail driver instance
   * @param {string} [driverName] - Specific driver to create (optional)
   * @returns {MailInterface} - Configured mail driver
   */
  static createDriver(driverName = null) {
    // If no specific driver requested, auto-detect based on environment
    if (!driverName) {
      driverName = this.detectConfiguredDriver();
    }

    switch (driverName?.toLowerCase()) {
      case 'sendgrid':
        return new SendGridDriver();
        
      case 'mailgun':
        return new MailgunDriver();
        
      default:
        throw new Error(`Unsupported mail driver: ${driverName}. Supported drivers: sendgrid, mailgun`);
    }
  }

  /**
   * Auto-detect which mail driver is configured
   * @returns {string} - The name of the configured driver
   */
  static detectConfiguredDriver() {
    // Check environment variable first
    const envDriver = process.env.MAIL_DRIVER?.toLowerCase();
    if (envDriver) {
      mailFactoryLogger.info(`Using mail driver from MAIL_DRIVER environment variable: ${envDriver}`);
      return envDriver;
    }

    // Auto-detect based on available configuration
    const sendGridConfigured = !!(process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL);
    const mailgunConfigured = !!(
      process.env.MAILGUN_API_KEY && 
      process.env.MAILGUN_DOMAIN && 
      process.env.MAILGUN_FROM_EMAIL
    );

    if (sendGridConfigured && mailgunConfigured) {
      mailFactoryLogger.warn('Both SendGrid and Mailgun are configured. Defaulting to SendGrid. Set MAIL_DRIVER environment variable to specify preference.');
      return 'sendgrid';
    }

    if (sendGridConfigured) {
      mailFactoryLogger.info('Auto-detected SendGrid configuration');
      return 'sendgrid';
    }

    if (mailgunConfigured) {
      mailFactoryLogger.info('Auto-detected Mailgun configuration');
      return 'mailgun';
    }

    throw new Error('No mail driver is configured. Please configure either SendGrid or Mailgun environment variables.');
  }

  /**
   * Get list of available drivers
   * @returns {Array<string>} - Array of supported driver names
   */
  static getAvailableDrivers() {
    return ['sendgrid', 'mailgun'];
  }

  /**
   * Check which drivers are currently configured
   * @returns {Object} - Object with driver availability status
   */
  static getDriverStatus() {
    return {
      sendgrid: {
        available: !!(process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL),
        required_vars: ['SENDGRID_API_KEY', 'SENDGRID_FROM_EMAIL']
      },
      mailgun: {
        available: !!(
          process.env.MAILGUN_API_KEY && 
          process.env.MAILGUN_DOMAIN && 
          process.env.MAILGUN_FROM_EMAIL
        ),
        required_vars: ['MAILGUN_API_KEY', 'MAILGUN_DOMAIN', 'MAILGUN_FROM_EMAIL']
      }
    };
  }
}

module.exports = MailFactory;