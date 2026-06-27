import AnonymizationJob from '../models/anonymization-job';
import TempData from '../models/temp-data';
import Log from '../models/log';
import { AnonymizationService } from './anonymization.service';

export interface RetentionReport {
  tempDataCount: number;
  logCount: number;
  pendingAnonymizationJobs: number;
  anonymizationJobsProcessed: number;
  anonymizationJobsFailed: number;
  durationMs: number;
}

const STALE_PENDING_MS = 60_000;

/**
 * Operational retention pass — TTL-backed collections and stuck erasure jobs.
 */
export class DataRetentionService {
  /** Runs a scheduled retention pass over TTL collections and stuck erasure jobs. */
  static async runRetentionPass(): Promise<RetentionReport> {
    const startTime = Date.now();

    const staleThreshold = new Date(Date.now() - STALE_PENDING_MS);

    const [tempDataCount, logCount, pendingJobs, failedJobs] =
      await Promise.all([
        TempData.estimatedDocumentCount(),
        Log.estimatedDocumentCount(),
        AnonymizationJob.find({
          status: 'pending',
          createdAt: { $lt: staleThreshold },
        }),
        AnonymizationJob.find({ status: 'failed' }),
      ]);

    const jobsToProcess = [...pendingJobs, ...failedJobs];
    let anonymizationJobsProcessed = 0;
    let anonymizationJobsFailed = 0;

    for (const job of jobsToProcess) {
      try {
        await AnonymizationService.executeJob(job);
        anonymizationJobsProcessed++;
      } catch {
        anonymizationJobsFailed++;
      }
    }

    return {
      tempDataCount,
      logCount,
      pendingAnonymizationJobs: pendingJobs.length,
      anonymizationJobsProcessed,
      anonymizationJobsFailed,
      durationMs: Date.now() - startTime,
    };
  }
}
