const mongoose = require('mongoose');
const { HeadBucketCommand } = require('@aws-sdk/client-s3');
const { getS3Client, isS3Configured } = require('./s3Storage');
const { isEmailConfigured } = require('./emailService');
const logger = require('./logger');
const fs = require('fs').promises;
const path = require('path');

const healthLogger = logger.child({ component: 'health' });

/**
 * Comprehensive health check for Media Management System
 */
class HealthChecker {
  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Check MongoDB connection health
   */
  async checkDatabase() {
    try {
      const start = Date.now();
      await mongoose.connection.db.admin().ping();
      
      const stats = await mongoose.connection.db.stats();
      return {
        status: 'healthy',
        responseTime: `${Date.now() - start}ms`,
        database: mongoose.connection.name,
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        collections: stats.collections,
        dataSize: Math.round(stats.dataSize / 1024 / 1024) + 'MB'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        connectionState: mongoose.connection.readyState
      };
    }
  }

  /**
   * Check S3 storage health
   */
  async checkS3Storage() {
    if (!isS3Configured) {
      return { status: 'not-configured' };
    }

    try {
      const start = Date.now();
      const s3Client = getS3Client();
      const bucket = process.env.S3_BUCKET;
      
      // Quick bucket access check
      await s3Client.send(new HeadBucketCommand({ Bucket: bucket }));
      
      return {
        status: 'healthy',
        responseTime: `${Date.now() - start}ms`,
        bucket: bucket,
        region: process.env.AWS_REGION
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        bucket: process.env.S3_BUCKET
      };
    }
  }

  /**
   * Check local file storage health
   */
  async checkLocalStorage() {
    try {
      const uploadsPath = path.join(__dirname, '../uploads');
      const start = Date.now();
      
      // Check if uploads directory exists and is writable
      await fs.access(uploadsPath, fs.constants.R_OK | fs.constants.W_OK);
      
      // Get directory stats
      const stats = await fs.stat(uploadsPath);
      const files = await fs.readdir(uploadsPath);
      
      return {
        status: 'healthy',
        responseTime: `${Date.now() - start}ms`,
        path: uploadsPath,
        fileCount: files.length,
        accessible: true,
        writable: true
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        path: path.join(__dirname, '../uploads')
      };
    }
  }

  /**
   * Check email service configuration
   */
  checkEmailService() {
    const configured = isEmailConfigured();
    return {
      status: configured ? 'configured' : 'not-configured',
      provider: configured ? 'sendgrid' : null,
      features: configured ? ['password-reset', 'welcome-emails'] : []
    };
  }

  /**
   * Check system resources
   */
  checkSystemResources() {
    const memUsage = process.memoryUsage();
    const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const memTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    
    // Memory warning if using > 95% of heap or > 200MB total
    // For this application: 34MB usage is normal, 80% heap utilization is efficient
    const memoryStatus = (memUsedMB > 200 || (memUsedMB / memTotalMB) > 0.95) ? 'warning' : 'healthy';
    
    return {
      status: memoryStatus,
      memory: {
        heapUsed: memUsedMB,
        heapTotal: memTotalMB,
        external: Math.round(memUsage.external / 1024 / 1024),
        unit: 'MB',
        percentage: Math.round((memUsedMB / memTotalMB) * 100)
      },
      uptime: Math.floor(process.uptime()),
      pid: process.pid,
      nodeVersion: process.version,
      platform: process.platform
    };
  }

  /**
   * Check critical dependencies (FFmpeg, Puppeteer)
   */
  async checkDependencies() {
    const checks = {};
    
    // Check FFmpeg
    try {
      const ffmpeg = require('@ffmpeg-installer/ffmpeg');
      checks.ffmpeg = {
        status: 'available',
        path: ffmpeg.path
      };
    } catch (error) {
      checks.ffmpeg = {
        status: 'unavailable',
        error: error.message
      };
    }

    // Check Puppeteer/Chromium
    try {
      const puppeteer = require('puppeteer');
      checks.chromium = {
        status: 'available',
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'bundled'
      };
    } catch (error) {
      checks.chromium = {
        status: 'unavailable',
        error: error.message
      };
    }

    return checks;
  }

  /**
   * Perform complete health check
   */
  async performHealthCheck() {
    const startTime = Date.now();
    const healthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      version: require('../package.json').version,
      environment: process.env.NODE_ENV || 'development',
      checks: {}
    };

    try {
      // Perform all checks in parallel for speed
      const [
        database,
        s3Storage,
        localStorage,
        emailService,
        systemResources,
        dependencies
      ] = await Promise.all([
        this.checkDatabase(),
        this.checkS3Storage(),
        this.checkLocalStorage(),
        Promise.resolve(this.checkEmailService()),
        Promise.resolve(this.checkSystemResources()),
        this.checkDependencies()
      ]);

      healthCheck.checks = {
        database,
        storage: {
          s3: s3Storage,
          local: localStorage
        },
        email: emailService,
        system: systemResources,
        dependencies
      };

      // Determine overall status
      const criticalChecks = [database, localStorage];
      const hasUnhealthy = criticalChecks.some(check => check.status === 'unhealthy');
      const hasWarnings = [systemResources].some(check => check.status === 'warning') ||
                         s3Storage.status === 'unhealthy';

      if (hasUnhealthy) {
        healthCheck.status = 'unhealthy';
      } else if (hasWarnings) {
        healthCheck.status = 'degraded';
      }

      healthCheck.responseTime = `${Date.now() - startTime}ms`;
      return healthCheck;

    } catch (error) {
      healthLogger.error('Health check failed', error);
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
        responseTime: `${Date.now() - startTime}ms`
      };
    }
  }
}

module.exports = HealthChecker;