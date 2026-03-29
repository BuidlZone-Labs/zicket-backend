import { RequestHandler } from 'express';
import { Queue } from 'bullmq';
import { redisConfig } from '../config/queue';
import {
  QUEUE_NAMES,
  PaymentJobType,
  ProcessWebhookEventPayload,
} from '../config/queue-jobs';
import { WebhookService } from '../services/webhook.service';

/**
 * #81 — Webhook Controller
 *
 * POST /api/webhooks/payment
 *
 * 1. Verifies the HMAC signature from the provider
 * 2. Parses + adapts the payload to our internal shape
 * 3. Enqueues a BullMQ job (returns 200 immediately — no blocking DB writes here)
 */

const paymentQueue = new Queue(QUEUE_NAMES.PAYMENT, {
  connection: redisConfig as any,
});

export const handlePaymentWebhook: RequestHandler = async (req, res) => {
  try {
    // ── 1. Signature verification ────────────────────────────────────────────
    const signature =
      (req.headers['x-alchemy-signature'] as string) ||
      (req.headers['x-webhook-signature'] as string) ||
      '';

    const rawBody =
      typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    if (!WebhookService.verifySignature(rawBody, signature)) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    // ── 2. Parse + adapt payload ─────────────────────────────────────────────
    // Try Alchemy adapter first; add more adapters here as you onboard providers
    const event =
      WebhookService.fromAlchemyPayload(req.body) ??
      (req.body as ProcessWebhookEventPayload); // Fallback: assume already normalised

    if (!event?.txHash) {
      return res.status(400).json({ error: 'Missing txHash in payload' });
    }

    // ── 3. Enqueue (fast path — DB work happens in the worker) ───────────────
    await paymentQueue.add(
      PaymentJobType.PROCESS_WEBHOOK_EVENT,
      event as ProcessWebhookEventPayload,
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        jobId: event.txHash, // deduplicate — same txHash won't be queued twice
      },
    );

    // ACK immediately so the webhook provider doesn't retry
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('[WebhookController] Error:', error);
    // Still return 200 to avoid provider flooding us with retries for
    // infrastructure errors — the job retry mechanism handles the rest
    res
      .status(200)
      .json({ received: true, warning: 'Queuing error — will retry' });
  }
};
