import { Worker, Job } from 'bullmq';
import { redisConfig } from '../config/queue';
import {
  QUEUE_NAMES,
  PaymentJobType,
  ProcessWebhookEventPayload,
} from '../config/queue-jobs';
import { WebhookService, WebhookPaymentEvent } from '../services/webhook.service';

/**
 * #81 — Payment Worker
 *
 * Processes jobs placed on the payment-queue by the webhook controller.
 * Decoupling the HTTP handler from DB writes means the webhook endpoint
 * returns 200 instantly, and retries are handled by BullMQ on failure.
 *
 * NOTE: BullMQ requires ioredis, not the `redis` package.
 * Update queue.ts import to: import IORedis from 'ioredis'
 * and redisConfig to use ioredis connection options.
 */

const paymentWorker = new Worker(
  QUEUE_NAMES.PAYMENT,
  async (job: Job<ProcessWebhookEventPayload>) => {
    const { name, data } = job;

    console.log(`[PaymentWorker] Processing job: ${name} | txHash: ${data.txHash}`);

    switch (name as PaymentJobType) {
      case PaymentJobType.PROCESS_WEBHOOK_EVENT: {
        const event: WebhookPaymentEvent = {
          txHash: data.txHash,
          from: data.from,
          to: data.to,
          valueWei: data.valueWei,
          blockNumber: data.blockNumber,
          confirmations: data.confirmations,
          status: data.status,
          timestamp: data.timestamp,
        };

        const result = await WebhookService.handlePaymentEvent(event);

        if (!result.processed) {
          console.warn(`[PaymentWorker] Not processed: ${result.message}`);
        } else {
          console.log(`[PaymentWorker] ✓ ${result.message}`);
        }

        return result;
      }

      default:
        console.warn(`[PaymentWorker] Unknown job type: ${name}`);
    }
  },
  {
    connection: redisConfig as any, // cast needed until queue.ts migrates to ioredis
    concurrency: 5,
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 },
  },
);

paymentWorker.on('failed', (job, err) => {
  console.error(
    `[PaymentWorker] Job ${job?.id} (${job?.name}) failed:`,
    err.message,
  );
});

paymentWorker.on('error', (err) => {
  console.error('[PaymentWorker] Worker error:', err);
});

export default paymentWorker;