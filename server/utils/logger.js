const winston = require('winston');

// Determine if we're in development or production
const isDevelopment = process.env.NODE_ENV !== 'production';

// Determine log level based on environment
const getLogLevel = () => {
  if (process.env.LOG_LEVEL) {
    return process.env.LOG_LEVEL;
  }
  return isDevelopment ? 'debug' : 'info';
};

// Define custom colors for log levels
const customColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  verbose: 'cyan',
  debug: 'blue',
  silly: 'grey'
};

// Tell winston about our custom colors
winston.addColors(customColors);

// Create the base format for our logs
const baseFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Create a colorized format for development
const devFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    
    // If there's additional metadata, stringify it
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    
    return msg;
  })
);

// Create the main logger instance
const logger = winston.createLogger({
  level: getLogLevel(),
  format: baseFormat,
  defaultMeta: { service: 'media-management-system' },
  transports: [
    new winston.transports.Console({
      format: isDevelopment ? devFormat : baseFormat
    })
  ]
});

// Function to create child loggers for different components
logger.createChildLogger = function(component) {
  return this.child({ component });
};

// Export the logger
module.exports = logger;

// Example usage:
// const logger = require('./utils/logger');
// 
// // Basic logging
// logger.info('Server started');
// logger.error('An error occurred', { error: err });
// logger.debug('Debug information', { data: someData });
// 
// // Using child logger for a specific component
// const dbLogger = logger.createChildLogger('database');
// dbLogger.info('Connected to MongoDB');
// dbLogger.error('Connection failed', { error: err });