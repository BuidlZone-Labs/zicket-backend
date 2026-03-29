import { Router } from 'express';
import {
  getQueueStatus,
  checkAsyncHealth,
} from '../controllers/queue-monitor.controller';

const router = Router();

/**
 * Queue Monitoring Routes
 * Provides visibility into async job processing
 */

// Get detailed queue statistics
router.get('/admin/queue/status', getQueueStatus);

// Get async processing health
router.get('/health/async', checkAsyncHealth);

export default router;
