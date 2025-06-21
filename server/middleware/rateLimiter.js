const logger = require('../utils/logger');

const rateLimitLogger = logger.child({ component: 'rate-limiter' });

/**
 * Simple in-memory rate limiter
 * In production, this should be replaced with Redis-based rate limiting
 */
class RateLimiter {
  constructor() {
    this.requests = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Cleanup every minute
  }
  
  /**
   * Check if request is within rate limit
   * @param {string} key - Unique identifier (IP + endpoint)
   * @param {number} limit - Max requests per window
   * @param {number} windowMs - Time window in milliseconds
   * @returns {Object} - { allowed: boolean, remaining: number, resetTime: Date }
   */
  checkLimit(key, limit, windowMs) {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (!this.requests.has(key)) {
      this.requests.set(key, []);
    }
    
    const requestTimes = this.requests.get(key);
    
    // Remove old requests outside the window
    const validRequests = requestTimes.filter(time => time > windowStart);
    this.requests.set(key, validRequests);
    
    if (validRequests.length >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: new Date(validRequests[0] + windowMs)
      };
    }
    
    // Add current request
    validRequests.push(now);
    this.requests.set(key, validRequests);
    
    return {
      allowed: true,
      remaining: limit - validRequests.length,
      resetTime: new Date(now + windowMs)
    };
  }
  
  /**
   * Cleanup old entries to prevent memory leaks
   */
  cleanup() {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    
    for (const [key, requests] of this.requests.entries()) {
      const validRequests = requests.filter(time => time > cutoff);
      if (validRequests.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, validRequests);
      }
    }
    
    rateLimitLogger.debug(`Rate limiter cleanup completed. Active keys: ${this.requests.size}`);
  }
  
  /**
   * Get rate limiter stats
   */
  getStats() {
    return {
      activeKeys: this.requests.size,
      totalRequests: Array.from(this.requests.values()).reduce((sum, arr) => sum + arr.length, 0)
    };
  }
}

// Global rate limiter instance
const rateLimiter = new RateLimiter();

/**
 * Express middleware for rate limiting
 * @param {Object} options - Rate limiting options
 * @param {number} options.limit - Max requests per window (default: 10)
 * @param {number} options.windowMs - Time window in ms (default: 15min)
 * @param {string} options.keyGenerator - Function to generate unique key
 * @param {string} options.message - Error message when rate limited
 */
function createRateLimit(options = {}) {
  const {
    limit = 10,
    windowMs = 15 * 60 * 1000, // 15 minutes
    keyGenerator = (req) => req.ip,
    message = 'Too many requests, please try again later'
  } = options;
  
  return (req, res, next) => {
    const key = `${keyGenerator(req)}:${req.route?.path || req.path}`;
    const result = rateLimiter.checkLimit(key, limit, windowMs);
    
    // Set rate limit headers
    res.set({
      'X-RateLimit-Limit': limit,
      'X-RateLimit-Remaining': result.remaining,
      'X-RateLimit-Reset': result.resetTime.toISOString()
    });
    
    if (!result.allowed) {
      rateLimitLogger.warn('Rate limit exceeded', {
        key,
        ip: req.ip,
        path: req.path,
        userAgent: req.get('User-Agent')
      });
      
      return res.status(429).json({
        error: message,
        retryAfter: result.resetTime
      });
    }
    
    next();
  };
}

// Predefined rate limiters for common use cases
const authRateLimit = createRateLimit({
  limit: 5, // 5 attempts
  windowMs: 15 * 60 * 1000, // 15 minutes
  message: 'Too many authentication attempts, please try again in 15 minutes'
});

const apiRateLimit = createRateLimit({
  limit: 100, // 100 requests
  windowMs: 15 * 60 * 1000, // 15 minutes
  message: 'Too many API requests, please try again later'
});

const strictAuthRateLimit = createRateLimit({
  limit: 3, // Only 3 attempts for sensitive operations
  windowMs: 60 * 60 * 1000, // 1 hour
  message: 'Too many attempts for this sensitive operation, please try again in 1 hour'
});

module.exports = {
  RateLimiter,
  createRateLimit,
  authRateLimit,
  apiRateLimit,
  strictAuthRateLimit,
  rateLimiter // Export instance for testing/monitoring
};