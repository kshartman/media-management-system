# Mail System

An abstracted mail system supporting multiple email providers with automatic driver detection and easy configuration.

## Supported Drivers

- **SendGrid** - Cloud-based email delivery service
- **Mailgun** - Email API service for developers

## Configuration

### Environment Variables

The mail system automatically detects which driver to use based on available environment variables.

#### SendGrid Configuration
```env
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
```

#### Mailgun Configuration
```env
MAILGUN_API_KEY=your_mailgun_api_key
MAILGUN_DOMAIN=yourdomain.com
MAILGUN_FROM_EMAIL=noreply@yourdomain.com
```

#### Driver Selection
```env
# Optional: Force a specific driver (sendgrid or mailgun)
MAIL_DRIVER=sendgrid
```

If `MAIL_DRIVER` is not set, the system will auto-detect based on available configuration:
1. If both drivers are configured, SendGrid takes precedence
2. If only one is configured, that driver is used
3. If neither is configured, an error is thrown

## Usage

### Basic Usage

```javascript
const { mailService } = require('./utils/mail');

// Send a basic email
await mailService.send({
  to: 'user@example.com',
  subject: 'Hello World',
  html: '<h1>Hello World</h1>',
  text: 'Hello World'
});
```

### Pre-built Email Methods

```javascript
const { mailService } = require('./utils/mail');

// Send welcome email with password setup
await mailService.sendWelcomeEmail(
  'user@example.com',
  'reset_token_here',
  'username'
);

// Send password reset email
await mailService.sendPasswordResetEmail(
  'user@example.com',
  'reset_token_here',
  'username'
);
```

### Legacy Compatibility

Existing code using the old `emailService` continues to work:

```javascript
const { isEmailConfigured, sendWelcomeEmail } = require('./utils/emailService');

if (isEmailConfigured()) {
  await sendWelcomeEmail('user@example.com', 'token', 'username');
}
```

### Status and Diagnostics

```javascript
const { mailService } = require('./utils/mail');

// Check if mail is configured
console.log(mailService.isConfigured()); // true/false

// Get detailed status
console.log(mailService.getStatus());
// {
//   initialized: true,
//   configured: true,
//   currentDriver: 'sendgrid',
//   availableDrivers: ['sendgrid', 'mailgun'],
//   driverStatus: {
//     sendgrid: { available: true, required_vars: [...] },
//     mailgun: { available: false, required_vars: [...] }
//   }
// }
```

## Architecture

### Components

1. **MailInterface** - Abstract base class defining the mail driver contract
2. **SendGridDriver** - SendGrid implementation of MailInterface
3. **MailgunDriver** - Mailgun implementation of MailInterface
4. **MailFactory** - Factory for creating and configuring drivers
5. **MailService** - High-level service with convenience methods
6. **emailService** - Legacy compatibility layer

### Directory Structure

```
server/utils/mail/
├── MailInterface.js      # Abstract base class
├── SendGridDriver.js     # SendGrid implementation
├── MailgunDriver.js      # Mailgun implementation
├── MailFactory.js        # Driver factory
├── MailService.js        # Main service (singleton)
├── index.js             # Module exports
└── README.md           # This documentation
```

## Adding New Drivers

To add a new mail driver:

1. Create a new driver class extending `MailInterface`
2. Implement required methods: `isConfigured()`, `send()`, `getDriverName()`
3. Add the driver to `MailFactory.createDriver()`
4. Update environment variable detection in `MailFactory.detectConfiguredDriver()`

Example:

```javascript
const MailInterface = require('./MailInterface');

class CustomDriver extends MailInterface {
  isConfigured() {
    return !!(process.env.CUSTOM_API_KEY);
  }

  async send(options) {
    // Implementation here
  }

  getDriverName() {
    return 'custom';
  }
}

module.exports = CustomDriver;
```

## Error Handling

The mail system provides detailed error messages:

```javascript
try {
  await mailService.send(options);
} catch (error) {
  console.error('Mail error:', error.message);
  // Logs include driver-specific error details
}
```

Common errors:
- Driver not configured
- Missing required fields (to, subject, content)
- API key invalid
- Rate limits exceeded
- Network connectivity issues

## Testing

The mail system can be tested by checking configuration status:

```javascript
const { getMailStatus } = require('./utils/mail');

console.log('Mail system status:', getMailStatus());
```

For development, consider using a service like [MailHog](https://github.com/mailhog/MailHog) or [Mailtrap](https://mailtrap.io/) to capture emails during testing.