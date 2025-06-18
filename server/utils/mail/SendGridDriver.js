const sgMail = require('@sendgrid/mail');
const MailInterface = require('./MailInterface');
const logger = require('../logger');

const sendGridLogger = logger.child({ service: 'sendGridDriver' });

/**
 * SendGrid Mail Driver
 * Implements the MailInterface using SendGrid
 */
class SendGridDriver extends MailInterface {
  constructor() {
    super();
    this.initialized = false;
    this.init();
  }

  /**
   * Initialize the SendGrid driver
   */
  init() {
    if (this.isConfigured()) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      this.initialized = true;
      sendGridLogger.info('SendGrid driver initialized successfully');
    } else {
      sendGridLogger.warn('SendGrid driver not configured - missing SENDGRID_API_KEY or SENDGRID_FROM_EMAIL');
    }
  }

  /**
   * Check if SendGrid is properly configured
   * @returns {boolean}
   */
  isConfigured() {
    return !!(process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL);
  }

  /**
   * Send an email using SendGrid
   * @param {Object} options - Email options
   * @param {string} options.to - Recipient email address
   * @param {string} [options.from] - Sender email address (defaults to SENDGRID_FROM_EMAIL)
   * @param {string} options.subject - Email subject
   * @param {string} options.html - HTML content
   * @param {string} options.text - Plain text content
   * @param {Array} [options.attachments] - Optional attachments
   * @returns {Promise<void>}
   */
  async send(options) {
    if (!this.isConfigured()) {
      throw new Error('SendGrid is not configured. Please set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL environment variables.');
    }

    if (!this.initialized) {
      throw new Error('SendGrid driver is not initialized');
    }

    const { to, from, subject, html, text, attachments } = options;

    if (!to || !subject || (!html && !text)) {
      throw new Error('Missing required email parameters: to, subject, and html or text');
    }

    const msg = {
      to,
      from: from || process.env.SENDGRID_FROM_EMAIL,
      subject,
      html,
      text
    };

    // Add attachments if provided
    if (attachments && Array.isArray(attachments)) {
      msg.attachments = attachments;
    }

    try {
      await sgMail.send(msg);
      sendGridLogger.info(`Email sent successfully to ${to} with subject: ${subject}`);
    } catch (error) {
      sendGridLogger.error('Error sending email via SendGrid', {
        to,
        subject,
        error: error.message,
        response: error.response?.body
      });
      throw new Error(`SendGrid email failed: ${error.message}`);
    }
  }

  /**
   * Get the driver name
   * @returns {string}
   */
  getDriverName() {
    return 'sendgrid';
  }
}

module.exports = SendGridDriver;