import { Worker, Job } from 'bullmq';
import { redisConfig } from '../config/queue';
import {
  WaitlistJobType,
  WaitlistJobPayload,
  ExpireHoldPayload,
  QUEUE_NAMES,
} from '../config/queue-jobs';
import WaitlistService from '../services/waitlist.service';
import logger from '../utils/logger';

/**
 * #168 - Processes delayed waitlist jobs (currently just EXPIRE_HOLD).
 */
class WaitlistWorker {
  private worker: Worker | null = null;

  async initialize(): Promise<void> {
    if (this.worker) {
      logger.info('WaitlistWorker already initialized');
      return;
    }

    this.worker = new Worker(
      QUEUE_NAMES.WAITLIST,
      async (job: Job) => {
        const jobType = job.name as WaitlistJobType;
        const payload = job.data as WaitlistJobPayload;

        switch (jobType) {
          case WaitlistJobType.EXPIRE_HOLD:
            await WaitlistService.expireHold(
              (payload as ExpireHoldPayload).waitlistId,
            );
            return { success: true };
          default:
            throw new Error(`Unknown waitlist job type: ${jobType}`);
        }
      },
      { connection: redisConfig },
    );

    this.worker.on('failed', (job, err) => {
      logger.error(`Waitlist job ${job?.id} failed:`, err.message);
    });

    logger.info('WaitlistWorker initialized successfully');
  }

  async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
  }
}

export default new WaitlistWorker();
