import { Worker, Queue, Job } from 'bullmq';
import { redisConfig } from '../config/queue';
import {
  QUEUE_NAMES,
  AnonymizationJobType,
  PostEventAnonymizePayload,
  REPEATABLE_JOBS,
} from '../config/queue-jobs';
import {
  runPostEventAnonymization,
  DEFAULT_RETENTION_DAYS,
} from '../services/post-event-anonymization.service';
import logger from '../utils/logger';

/**
 * #179 — Post-Event Anonymization Worker
 *
 * Daily pass that finds completed events past the retention window and
 * redacts sensitive attendee PII (email, display name) from User documents.
 * Active / disputed events are never touched.
 *
 * Schedule: configurable via ANONYMIZATION_CRON (default: daily at 4 AM).
 * Retention window: configurable via RETENTION_DAYS env var (default: 30 days).
 */

// ─── Queue (shared handle so we can enqueue from other modules) ──────────────

export const anonymizationQueue = new Queue(QUEUE_NAMES.ANONYMIZATION, {
  connection: redisConfig as any,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 60_000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 },
  },
});

// ─── Register repeatable job on startup ──────────────────────────────────────

/**
 * Registers the repeatable anonymization cron after env validation (server startup).
 */
export async function initializeAnonymizationWorker(): Promise<void> {
  const { name, opts } = REPEATABLE_JOBS.POST_EVENT_ANONYMIZE;

  await anonymizationQueue.add(
    name,
    {
      triggeredBy: 'schedule',
      timestamp: Date.now(),
    } as PostEventAnonymizePayload,
    opts,
  );

  logger.info(
    `[AnonymizationWorker] Repeatable job registered — pattern: ${opts.repeat.pattern}`,
  );
}

// ─── Worker ──────────────────────────────────────────────────────────────────

const anonymizationWorker = new Worker(
  QUEUE_NAMES.ANONYMIZATION,
  async (job: Job<PostEventAnonymizePayload>) => {
    const { name, data } = job;

    logger.info(
      `[AnonymizationWorker] Starting run — triggeredBy: ${data.triggeredBy}`,
    );

    switch (name as AnonymizationJobType) {
      case AnonymizationJobType.POST_EVENT_ANONYMIZE: {
        const rawOverride = data.retentionDaysOverride;
        const retentionDays =
          rawOverride != null &&
          Number.isFinite(rawOverride) &&
          rawOverride >= 0
            ? rawOverride
            : parseInt(process.env.RETENTION_DAYS || '', 10) ||
              DEFAULT_RETENTION_DAYS;
        const trigger =
          data.triggeredBy === 'manual' ? 'manual' : 'retention_expired';
        const report = await runPostEventAnonymization(retentionDays, trigger);
        return report;
      }

      default:
        logger.warn(`[AnonymizationWorker] Unknown job type: ${name}`);
    }
  },
  {
    connection: redisConfig as any,
    autorun: false, // Started explicitly after DB init in start.ts
    concurrency: 1, // Only one anonymization run at a time
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 },
  },
);

anonymizationWorker.on('completed', (job, result) => {
  const r = result as any;
  if (r) {
    logger.info(
      `[AnonymizationWorker] ✓ Run complete — scanned: ${r.eventsScanned}, ` +
        `eligible: ${r.eventsEligible}, ` +
        `ordersScanned: ${r.ordersScanned}, ` +
        `usersRedacted: ${r.usersRedacted}, ` +
        `auditLogs: ${r.auditLogsCreated}, ` +
        `duration: ${r.durationMs}ms`,
    );
  }
});

anonymizationWorker.on('failed', (job, err) => {
  logger.error(`[AnonymizationWorker] Job ${job?.id} failed: ${err.message}`);
});

anonymizationWorker.on('error', (err) => {
  logger.error('[AnonymizationWorker] Worker error:', err);
});

export { anonymizationWorker };
export default anonymizationWorker;
