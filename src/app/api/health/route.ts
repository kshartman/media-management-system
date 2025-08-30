import { NextResponse } from 'next/server';

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  environment: string;
  checks: {
    nextjs: 'operational' | 'error';
    memory: {
      used: number;
      limit: number;
      percentage: number;
    };
    backend?: 'connected' | 'unreachable' | 'error' | 'timeout';
    backendLatency?: number;
  };
  version?: string;
}

export async function GET() {
  const startTime = Date.now();
  
  const health: HealthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    checks: {
      nextjs: 'operational',
      memory: {
        used: 0,
        limit: 0,
        percentage: 0
      }
    }
  };

  // Check memory usage
  try {
    const memUsage = process.memoryUsage();
    const heapUsed = memUsage.heapUsed;
    const heapTotal = memUsage.heapTotal;
    const percentage = Math.round((heapUsed / heapTotal) * 100);
    
    health.checks.memory = {
      used: Math.round(heapUsed / 1024 / 1024), // Convert to MB
      limit: Math.round(heapTotal / 1024 / 1024), // Convert to MB
      percentage
    };

    // Warn if memory usage is high
    if (percentage > 90) {
      health.status = 'degraded';
    }
  } catch (error) {
    console.error('Failed to check memory:', error);
    health.checks.nextjs = 'error';
    health.status = 'unhealthy';
  }

  // Check backend connectivity
  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://backend:5001';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    const backendStart = Date.now();
    const response = await fetch(`${backendUrl}/api/health`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Frontend-HealthCheck/1.0'
      }
    });
    clearTimeout(timeoutId);
    
    const backendLatency = Date.now() - backendStart;
    health.checks.backendLatency = backendLatency;
    
    if (response.ok) {
      health.checks.backend = 'connected';
      
      // Warn if backend is slow
      if (backendLatency > 2000) {
        health.status = health.status === 'unhealthy' ? 'unhealthy' : 'degraded';
      }
    } else {
      health.checks.backend = 'unreachable';
      health.status = 'degraded';
    }
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      health.checks.backend = 'timeout';
    } else {
      health.checks.backend = 'error';
    }
    // Frontend can still be healthy even if backend is down
    health.status = health.status === 'unhealthy' ? 'unhealthy' : 'degraded';
  }

  // Add version info if available
  if (process.env.npm_package_version) {
    health.version = process.env.npm_package_version;
  }

  // Set appropriate HTTP status code
  const httpStatus = health.status === 'healthy' ? 200 : 
                     health.status === 'degraded' ? 200 : 503;

  // Add response time
  const responseTime = Date.now() - startTime;
  
  return NextResponse.json({
    ...health,
    responseTime
  }, { 
    status: httpStatus,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Response-Time': `${responseTime}ms`
    }
  });
}