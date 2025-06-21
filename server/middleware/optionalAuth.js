const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const authLogger = logger.child({ component: 'optional-auth-middleware' });

const JWT_SECRET = process.env.JWT_SECRET;

// Optional auth middleware - populates req.user if valid token provided, but doesn't fail if no token
const optionalAuthMiddleware = (req, res, next) => {
  try {
    // Try to get token from cookie first, then fallback to Authorization header
    let token = req.cookies?.auth_token;
    
    if (!token) {
      // Fallback to Authorization header
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }
    
    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      authLogger.debug(`Optional auth successful for user: ${decoded.username} (${decoded.role})`);
    }
    
    // If no token or invalid token, just continue without setting req.user
    next();
  } catch (error) {
    // Log the error but don't fail the request
    authLogger.debug('Optional auth failed, continuing without authentication:', error.message);
    
    // Clear invalid cookie if it exists (but don't fail the request)
    if (req.cookies?.auth_token) {
      res.clearCookie('auth_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/'
      });
    }
    
    next();
  }
};

module.exports = optionalAuthMiddleware;