const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const authLogger = logger.child({ component: 'auth-middleware' });

const JWT_SECRET = process.env.JWT_SECRET;

const authMiddleware = (req, res, next) => {
  try {
    // Try to get token from cookie first, then fallback to Authorization header for backwards compatibility
    let token = req.cookies?.auth_token;
    
    if (!token) {
      // Fallback to Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized - No valid token provided' });
      }
      token = authHeader.split(' ')[1];
    }
    
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    authLogger.error('Authentication error:', error);
    
    // Clear invalid cookie if it exists
    if (req.cookies?.auth_token) {
      res.clearCookie('auth_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/'
      });
    }
    
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = authMiddleware;