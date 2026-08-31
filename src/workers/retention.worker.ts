import { Worker, Queue, Job } from 'bullmq';
import { redisConfig } from '../config/queue';
import {
  QUEUE_NAMES,
  RetentionJobType,
  RetentionPayload,
  REPEATABLE_JOBS,
} from '../config/queue-jobs';
import { DataRetentionService } from '../services/data-retention.service';
import logger from '../utils/logger';

/**
 * #127 — Retention Worker
 *
 * Daily pass over TTL-backed collections and stuck anonymization jobs.
 */

export const retentionQueue = new Queue(QUEUE_NAMES.RETENTION, {
  connection: redisConfig as any,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 60_000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 },
  },
});

/**
 * Registers the repeatable retention cron after env validation (server startup).
 */
export async function initializeRetentionWorker(): Promise<void> {
  const { name, opts } = REPEATABLE_JOBS.RUN_RETENTION_PASS;

  await retentionQueue.add(
    name,
    { triggeredBy: 'schedule', timestamp: Date.now() } as RetentionPayload,
    opts,
  );

  logger.info(
    `[RetentionWorker] Repeatable job registered — pattern: ${opts.repeat.pattern}`,
  );
}

const retentionWorker = new Worker(
  QUEUE_NAMES.RETENTION,
  async (job: Job<RetentionPayload>) => {
    const { name, data } = job;

    logger.info(
      `[RetentionWorker] Starting run — triggeredBy: ${data.triggeredBy}`,
    );

    switch (name as RetentionJobType) {
      case RetentionJobType.RUN_RETENTION_PASS: {
        const report = await DataRetentionService.runRetentionPass();
        return report;
      }

      default:
        logger.warn(`[RetentionWorker] Unknown job type: ${name}`);
    }
  },
  {
    connection: redisConfig as any,
    concurrency: 1,
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 },
  },
);

retentionWorker.on('completed', (job, result) => {
  const r = result as any;
  if (r) {
    logger.info(
      `[RetentionWorker] ✓ Run complete — tempData: ${r.tempDataCount}, ` +
        `logs: ${r.logCount}, pendingJobs: ${r.pendingAnonymizationJobs}, ` +
        `processed: ${r.anonymizationJobsProcessed}, ` +
        `failed: ${r.anonymizationJobsFailed}, duration: ${r.durationMs}ms`,
    );
  }
});

retentionWorker.on('failed', (job, err) => {
  logger.error(`[RetentionWorker] Job ${job?.id} failed: ${err.message}`);
});

retentionWorker.on('error', (err) => {
  logger.error('[RetentionWorker] Worker error:', err);
});

export default retentionWorker;
