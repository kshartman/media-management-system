const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

const debugLogger = logger.child({ component: 'debug' });

// Valid log levels (from Winston)
const VALID_LOG_LEVELS = ['error', 'warn', 'info', 'debug'];

/**
 * GET /api/debug/loglevel
 * Returns the current log level
 */
router.get('/loglevel', (req, res) => {
  try {
    const currentLevel = logger.level;
    debugLogger.info(`Current log level requested: ${currentLevel}`);
    
    res.json({
      success: true,
      logLevel: currentLevel,
      validLevels: VALID_LOG_LEVELS
    });
  } catch (error) {
    debugLogger.error('Error getting log level:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get log level'
    });
  }
});

/**
 * POST /api/debug/loglevel
 * Sets the log level dynamically
 */
router.post('/loglevel', (req, res) => {
  try {
    const { logLevel } = req.body;
    
    if (!logLevel) {
      return res.status(400).json({
        success: false,
        error: 'logLevel is required',
        validLevels: VALID_LOG_LEVELS
      });
    }
    
    if (!VALID_LOG_LEVELS.includes(logLevel)) {
      return res.status(400).json({
        success: false,
        error: `Invalid log level. Must be one of: ${VALID_LOG_LEVELS.join(', ')}`,
        validLevels: VALID_LOG_LEVELS
      });
    }
    
    const previousLevel = logger.level;
    logger.level = logLevel;
    
    debugLogger.warn(`Log level changed from '${previousLevel}' to '${logLevel}'`);
    
    res.json({
      success: true,
      previousLevel,
      newLevel: logLevel,
      message: `Log level successfully changed to '${logLevel}'`
    });
  } catch (error) {
    debugLogger.error('Error setting log level:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set log level'
    });
  }
});

module.exports = router;