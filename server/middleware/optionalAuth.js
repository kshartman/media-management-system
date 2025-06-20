const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const authLogger = logger.child({ component: 'optional-auth-middleware' });

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Optional auth middleware - populates req.user if valid token provided, but doesn't fail if no token
const optionalAuthMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      authLogger.debug(`Optional auth successful for user: ${decoded.username} (${decoded.role})`);
    }
    // If no token or invalid token, just continue without setting req.user
    next();
  } catch (error) {
    // Log the error but don't fail the request
    authLogger.debug('Optional auth failed, continuing without authentication:', error.message);
    next();
  }
};

module.exports = optionalAuthMiddleware;