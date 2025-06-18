const formData = require('form-data');
const MailInterface = require('./MailInterface');
const logger = require('../logger');

const mailgunLogger = logger.child({ service: 'mailgunDriver' });

/**
 * Mailgun Mail Driver
 * Implements the MailInterface using Mailgun
 */
class MailgunDriver extends MailInterface {
  constructor() {
    super();
    this.initialized = false;
    this.init();
  }

  /**
   * Initialize the Mailgun driver
   */
  init() {
    if (this.isConfigured()) {
      this.initialized = true;
      mailgunLogger.info('Mailgun driver initialized successfully');
    } else {
      mailgunLogger.warn('Mailgun driver not configured - missing MAILGUN_API_KEY, MAILGUN_DOMAIN, or MAILGUN_FROM_EMAIL');
    }
  }

  /**
   * Check if Mailgun is properly configured
   * @returns {boolean}
   */
  isConfigured() {
    return !!(
      process.env.MAILGUN_API_KEY && 
      process.env.MAILGUN_DOMAIN && 
      process.env.MAILGUN_FROM_EMAIL
    );
  }

  /**
   * Send an email using Mailgun
   * @param {Object} options - Email options
   * @param {string} options.to - Recipient email address
   * @param {string} [options.from] - Sender email address (defaults to MAILGUN_FROM_EMAIL)
   * @param {string} options.subject - Email subject
   * @param {string} options.html - HTML content
   * @param {string} options.text - Plain text content
   * @param {Array} [options.attachments] - Optional attachments
   * @returns {Promise<void>}
   */
  async send(options) {
    if (!this.isConfigured()) {
      throw new Error('Mailgun is not configured. Please set MAILGUN_API_KEY, MAILGUN_DOMAIN, and MAILGUN_FROM_EMAIL environment variables.');
    }

    if (!this.initialized) {
      throw new Error('Mailgun driver is not initialized');
    }

    const { to, from, subject, html, text, attachments } = options;

    if (!to || !subject || (!html && !text)) {
      throw new Error('Missing required email parameters: to, subject, and html or text');
    }

    // Create form data for Mailgun API
    const form = new formData();
    form.append('from', from || process.env.MAILGUN_FROM_EMAIL);
    form.append('to', to);
    form.append('subject', subject);
    
    if (html) {
      form.append('html', html);
    }
    
    if (text) {
      form.append('text', text);
    }

    // Add attachments if provided
    if (attachments && Array.isArray(attachments)) {
      attachments.forEach((attachment, index) => {
        if (attachment.content && attachment.filename) {
          form.append(`attachment[${index}]`, attachment.content, {
            filename: attachment.filename,
            contentType: attachment.type || 'application/octet-stream'
          });
        }
      });
    }

    const url = `https://api.mailgun.net/v3/${process.env.MAILGUN_DOMAIN}/messages`;

    try {
      const fetch = (await import('node-fetch')).default;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64')}`,
          ...form.getHeaders()
        },
        body: form
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      mailgunLogger.info(`Email sent successfully to ${to} with subject: ${subject}`, {
        messageId: result.id
      });

    } catch (error) {
      mailgunLogger.error('Error sending email via Mailgun', {
        to,
        subject,
        error: error.message
      });
      throw new Error(`Mailgun email failed: ${error.message}`);
    }
  }

  /**
   * Get the driver name
   * @returns {string}
   */
  getDriverName() {
    return 'mailgun';
  }
}

module.exports = MailgunDriver;