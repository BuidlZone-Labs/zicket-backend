import { Worker, Queue, Job } from 'bullmq';
import { redisConfig } from '../config/queue';
import {
  QUEUE_NAMES,
  RetentionJobType,
  RetentionPayload,
  REPEATABLE_JOBS,
} from '../config/queue-jobs';
import { DataRetentionService } from '../services/data-retention.service';

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

(async () => {
  try {
    const { name, opts } = REPEATABLE_JOBS.RUN_RETENTION_PASS;

    await retentionQueue.add(
      name,
      { triggeredBy: 'schedule', timestamp: Date.now() } as RetentionPayload,
      opts,
    );

    console.log(
      `[RetentionWorker] Repeatable job registered — pattern: ${opts.repeat.pattern}`,
    );
  } catch (err) {
    console.error('[RetentionWorker] Failed to register repeatable job:', err);
  }
})();

const retentionWorker = new Worker(
  QUEUE_NAMES.RETENTION,
  async (job: Job<RetentionPayload>) => {
    const { name, data } = job;

    console.log(
      `[RetentionWorker] Starting run — triggeredBy: ${data.triggeredBy}`,
    );

    switch (name as RetentionJobType) {
      case RetentionJobType.RUN_RETENTION_PASS: {
        const report = await DataRetentionService.runRetentionPass();
        return report;
      }

      default:
        console.warn(`[RetentionWorker] Unknown job type: ${name}`);
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
    console.log(
      `[RetentionWorker] ✓ Run complete — tempData: ${r.tempDataCount}, ` +
        `logs: ${r.logCount}, pendingJobs: ${r.pendingAnonymizationJobs}, ` +
        `processed: ${r.anonymizationJobsProcessed}, ` +
        `failed: ${r.anonymizationJobsFailed}, duration: ${r.durationMs}ms`,
    );
  }
});

retentionWorker.on('failed', (job, err) => {
  console.error(`[RetentionWorker] Job ${job?.id} failed: ${err.message}`);
});

retentionWorker.on('error', (err) => {
  console.error('[RetentionWorker] Worker error:', err);
});

export default retentionWorker;
