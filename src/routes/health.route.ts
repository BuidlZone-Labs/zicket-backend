import express, { Request, Response } from 'express';
import healthService from '../services/health.service';

const router = express.Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns comprehensive health metrics including database, Redis, and indexer status
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: Service is healthy or degraded with detailed metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, degraded, unhealthy]
 *                   description: Overall health status
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   description: ISO timestamp of health check
 *                 uptime:
 *                   type: number
 *                   description: Server uptime in seconds
 *                 service:
 *                   type: string
 *                   description: Service name
 *                 database:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [connected, disconnected]
 *                     responseTime:
 *                       type: number
 *                       description: Database response time in milliseconds
 *                     poolSize:
 *                       type: number
 *                       description: Current connection pool size
 *                     message:
 *                       type: string
 *                 redis:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [connected, disconnected]
 *                     responseTime:
 *                       type: number
 *                       description: Redis response time in milliseconds
 *                     message:
 *                       type: string
 *                 indexer:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [healthy, lagging, unavailable]
 *                     laggedContracts:
 *                       type: number
 *                     totalIndexedContracts:
 *                       type: number
 *                     message:
 *                       type: string
 *       503:
 *         description: Service is unhealthy (database or Redis disconnected)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [unhealthy]
 *                 timestamp:
 *                   type: string
 *                 message:
 *                   type: string
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const metrics = await healthService.getHealthMetrics();

    // Return 503 if unhealthy (critical services down)
    if (metrics.status === 'unhealthy') {
      return res.status(503).json({
        status: metrics.status,
        timestamp: metrics.timestamp,
        message: 'Service unhealthy: critical services are not available',
        details: metrics,
      });
    }

    // Return 200 for healthy or degraded status
    res.status(200).json(metrics);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      message: 'Health check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
