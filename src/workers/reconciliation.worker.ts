import { Worker, Queue, Job } from 'bullmq';
import { redisConfig } from '../config/queue';
import {
  QUEUE_NAMES,
  ReconciliationJobType,
  ReconcilePayload,
  REPEATABLE_JOBS,
} from '../config/queue-jobs';
import { ReconciliationService } from '../services/reconciliation.service';

/**
 * #78 — Reconciliation Worker
 *
 * Runs on a repeatable schedule (default: every 15 minutes, configurable via
 * RECONCILIATION_CRON env var).  On each run it calls ReconciliationService
 * which finds stale pending transactions, re-checks their on-chain status,
 * and corrects any DB mismatches.
 *
 * To trigger a manual reconciliation:
 *   POST /api/admin/reconcile   (see reconciliation controller if you add one)
 * Or enqueue directly:
 *   reconciliationQueue.add(ReconciliationJobType.RECONCILE_PENDING, { triggeredBy: 'manual', timestamp: Date.now() })
 */

// ─── Queue (shared handle so we can enqueue from other modules) ──────────────

export const reconciliationQueue = new Queue(QUEUE_NAMES.RECONCILIATION, {
  connection: redisConfig as any,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 30_000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 },
  },
});

// ─── Register repeatable job on startup ──────────────────────────────────────

(async () => {
  try {
    const { name, opts } = REPEATABLE_JOBS.RECONCILE_PENDING;

    await reconciliationQueue.add(
      name,
      { triggeredBy: 'schedule', timestamp: Date.now() } as ReconcilePayload,
      opts,
    );

    console.log(
      `[ReconciliationWorker] Repeatable job registered — pattern: ${opts.repeat.pattern}`,
    );
  } catch (err) {
    console.error(
      '[ReconciliationWorker] Failed to register repeatable job:',
      err,
    );
  }
})();

// ─── Worker ──────────────────────────────────────────────────────────────────

const reconciliationWorker = new Worker(
  QUEUE_NAMES.RECONCILIATION,
  async (job: Job<ReconcilePayload>) => {
    const { name, data } = job;

    console.log(
      `[ReconciliationWorker] Starting run — triggeredBy: ${data.triggeredBy}`,
    );

    switch (name as ReconciliationJobType) {
      case ReconciliationJobType.RECONCILE_PENDING: {
        const report =
          await ReconciliationService.reconcilePendingTransactions();

        // Surface any errors through BullMQ's job result
        if (report.errors.length > 0) {
          console.warn(
            `[ReconciliationWorker] ${report.errors.length} error(s) during reconciliation`,
          );
        }

        return report;
      }

      default:
        console.warn(`[ReconciliationWorker] Unknown job type: ${name}`);
    }
  },
  {
    connection: redisConfig as any,
    concurrency: 1, // Only one reconciliation run at a time
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 },
  },
);

reconciliationWorker.on('completed', (job, result) => {
  const r = result as any;
  if (r) {
    console.log(
      `[ReconciliationWorker] ✓ Run complete — scanned: ${r.scanned}, ` +
        `confirmed: ${r.confirmed}, failed: ${r.failed}, ` +
        `skipped: ${r.skipped}, duration: ${r.durationMs}ms`,
    );
  }
});

reconciliationWorker.on('failed', (job, err) => {
  console.error(`[ReconciliationWorker] Job ${job?.id} failed: ${err.message}`);
});

reconciliationWorker.on('error', (err) => {
  console.error('[ReconciliationWorker] Worker error:', err);
});

export default reconciliationWorker;
