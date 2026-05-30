import { Worker, Job } from 'bullmq';
import { redisConfig, queueConfig } from '../config/queue';
import {
  ZkEmailJobType,
  ZkEmailHookPayload,
  ZkEmailJobResult,
  QUEUE_NAMES,
} from '../config/queue-jobs';

class ZkEmailWorker {
  private worker: Worker | null = null;

  async initialize(): Promise<void> {
    try {
      this.worker = new Worker(
        QUEUE_NAMES.ZKEMAIL,
        async (job: Job) => {
          return this.processJob(job);
        },
        {
          connection: redisConfig,
          concurrency: queueConfig.worker.concurrency,
        },
      );

      this.worker.on('completed', (job) => {
        console.log(`✓ zkEmail job ${job.id} completed successfully`);
      });

      this.worker.on('failed', (job, error) => {
        console.error(
          `✗ zkEmail job ${job?.id} failed (attempt ${job?.attemptsMade}/${job?.opts.attempts}):`,
          error.message,
        );
      });

      this.worker.on('error', (error) => {
        console.error('zkEmail worker error:', error);
      });

      console.log('zkEmail worker initialized successfully');
    } catch (error) {
      console.error('Failed to initialize ZkEmailWorker:', error);
      throw error;
    }
  }

  private async processJob(job: Job): Promise<ZkEmailJobResult> {
    try {
      const jobType = job.name as ZkEmailJobType;

      console.log(
        `Processing zkEmail job: ${jobType} [ID: ${job.id}], Attempt: ${job.attemptsMade + 1}/${job.opts.attempts}`,
      );

      switch (jobType) {
        case ZkEmailJobType.ZK_EMAIL_HOOK:
          return this.processZkEmailHook(
            job.data as ZkEmailHookPayload,
            job.id!,
          );

        default:
          throw new Error(`Unknown zkEmail job type: ${jobType}`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error(`zkEmail job ${job.id} error:`, errorMessage);
      throw error;
    }
  }

  private async processZkEmailHook(
    payload: ZkEmailHookPayload,
    jobId: string,
  ): Promise<ZkEmailJobResult> {
    const { hashedEmail } = payload;

    // hashedEmail is the SHA256 hex digest of the user's email address.
    // No raw email is stored or logged here.
    console.log(`Triggering zkEmail flow for job ${jobId}`);

    const relayUrl = process.env.ZKEMAIL_RELAY_URL;

    if (relayUrl) {
      const body = JSON.stringify({ hashedEmail });
      const url = new URL(relayUrl);
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      };

      await new Promise<void>((resolve, reject) => {
        const lib =
          url.protocol === 'https:' ? require('https') : require('http');
        const req = lib.request(options, (res: any) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(
              new Error(
                `zkEmail relay responded with status ${res.statusCode}`,
              ),
            );
          }
          res.resume();
        });
        req.on('error', reject);
        req.write(body);
        req.end();
      });

      console.log(`zkEmail relay notified for job ${jobId}`);
    } else {
      console.log(
        `zkEmail relay URL not configured (ZKEMAIL_RELAY_URL). Job ${jobId} recorded.`,
      );
    }

    return {
      success: true,
      jobId,
      timestamp: new Date(),
    };
  }

  async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      console.log('zkEmail worker closed');
    }
  }
}

export default new ZkEmailWorker();
