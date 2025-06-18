/**
 * Abstract Mail Interface
 * Defines the contract that all mail drivers must implement
 */
class MailInterface {
  /**
   * Check if the mail driver is properly configured
   * @returns {boolean}
   */
  isConfigured() {
    throw new Error('isConfigured method must be implemented');
  }

  /**
   * Send an email
   * @param {Object} options - Email options
   * @param {string} options.to - Recipient email address
   * @param {string} options.from - Sender email address
   * @param {string} options.subject - Email subject
   * @param {string} options.html - HTML content
   * @param {string} options.text - Plain text content
   * @param {Array} [options.attachments] - Optional attachments
   * @returns {Promise<void>}
   */
  async send(options) {
    throw new Error('send method must be implemented');
  }

  /**
   * Get the driver name
   * @returns {string}
   */
  getDriverName() {
    throw new Error('getDriverName method must be implemented');
  }
}

module.exports = MailInterface;