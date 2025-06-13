const sgMail = require('@sendgrid/mail');

// Check if SendGrid is configured
const isEmailConfigured = () => {
  return !!(process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL);
};

// Initialize SendGrid if configured
if (isEmailConfigured()) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const sendWelcomeEmail = async (to, resetToken, username) => {
  if (!isEmailConfigured()) {
    throw new Error('Email service is not configured. Please set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL environment variables.');
  }

  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
  
  const msg = {
    to,
    from: process.env.SENDGRID_FROM_EMAIL,
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

  try {
    await sgMail.send(msg);
    console.log(`Welcome email sent to ${to}`);
  } catch (error) {
    console.error('Error sending welcome email:', error);
    throw error;
  }
};

const sendPasswordResetEmail = async (to, resetToken, username) => {
  if (!isEmailConfigured()) {
    throw new Error('Email service is not configured. Please set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL environment variables.');
  }

  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
  
  const msg = {
    to,
    from: process.env.SENDGRID_FROM_EMAIL,
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

  try {
    await sgMail.send(msg);
    console.log(`Password reset email sent to ${to}`);
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
};

module.exports = {
  isEmailConfigured,
  sendPasswordResetEmail,
  sendWelcomeEmail
};