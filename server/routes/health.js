const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const HealthChecker = require('../utils/healthCheck');
const logger = require('../utils/logger');

const healthLogger = logger.child({ component: 'health' });

// Simple liveness probe - always returns 200 if server is responding
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime())
  });
});

// Comprehensive health check
router.get('/api/health', async (req, res) => {
  const healthChecker = new HealthChecker();
  const healthCheck = await healthChecker.performHealthCheck();
  
  const statusCode = healthCheck.status === 'healthy' ? 200 :
                     healthCheck.status === 'degraded' ? 200 : 503;
  
  healthLogger.info('Health check performed', {
    status: healthCheck.status,
    responseTime: healthCheck.responseTime
  });
  
  res.status(statusCode).json(healthCheck);
});

// Readiness probe - checks if app is ready to serve traffic
router.get('/api/health/ready', async (req, res) => {
  try {
    // Check critical dependencies only
    await mongoose.connection.db.admin().ping();
    
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (error) {
    healthLogger.warn('Readiness check failed', error);
    res.status(503).json({
      status: 'not-ready',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

module.exports = router;