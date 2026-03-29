import { RequestHandler } from 'express';
import queueService from '../services/queue.service';

/**
 * Queue monitoring endpoint
 * Returns real-time statistics about email queue processing
 */
export const getQueueStatus: RequestHandler = async (req, res) => {
  try {
    const stats = await queueService.getQueueStats();

    if (!stats) {
      return res.status(503).json({
        error: 'Queue service unavailable',
        message: 'Queue has not been initialized',
      });
    }

    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      queue: stats,
      description: {
        active: 'Jobs currently being processed',
        waiting: 'Jobs queued and waiting to be processed',
        completed: 'Successfully completed jobs from the last hour',
        failed: 'Jobs that failed and will be retried',
        delayed: 'Jobs scheduled for future processing',
      },
    });
  } catch (error: any) {
    console.error('Error fetching queue status:', error.message);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch queue status',
    });
  }
};

/**
 * Health check for async processing
 * Verifies queue and worker are operational
 */
export const checkAsyncHealth: RequestHandler = async (req, res) => {
  try {
    const stats = await queueService.getQueueStats();

    if (!stats) {
      return res.status(503).json({
        status: 'degraded',
        message: 'Queue service not initialized',
      });
    }

    // Health is good if queue is operational
    res.status(200).json({
      status: 'healthy',
      message: 'Async processing system operational',
      timestamp: new Date().toISOString(),
      queueMetrics: {
        totalPending:
          stats.waiting + stats.delayed,
        processing: stats.active,
        completed: stats.completed,
        failed: stats.failed,
      },
    });
  } catch (error: any) {
    res.status(503).json({
      status: 'unhealthy',
      message: 'Async processing system error',
      error: error.message,
    });
  }
};
