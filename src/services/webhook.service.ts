import crypto from 'crypto';
import Transaction from '../models/transaction';
import {
  TransactionStateMachine,
  TransactionEvent,
} from '../state-machine/transaction.state-machine';

/**
 * #81 #80 — Payment Webhook / Listener Service
 *
 * Designed to receive POST events from any blockchain webhook provider
 * (Alchemy Notify, Moralis Streams, QuickNode Streams, custom indexer, etc.)
 *
 * Security: HMAC-SHA256 signature verification before any processing.
 *
 * All state transitions are delegated to TransactionStateMachine, which
 * enforces valid transitions and prevents false confirmations.
 */

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

/** Normalised shape we expect from any webhook provider after adapter mapping */
export interface WebhookPaymentEvent {
  txHash: string;
  from: string;
  to: string;
  valueWei: string; // BigInt serialised as string
  blockNumber: number;
  confirmations: number;
  status: 'confirmed' | 'failed';
  timestamp: number; // unix seconds
}

export interface WebhookProcessResult {
  processed: boolean;
  message: string;
}

export class WebhookService {
  // ─── Signature helpers ────────────────────────────────────────────────────

  /**
   * Verify HMAC-SHA256 webhook signature.
   * Call this before doing anything with the payload.
   */
  static verifySignature(rawBody: string, signatureHeader: string): boolean {
    if (!WEBHOOK_SECRET) {
      // In production this should throw — for dev convenience we warn and pass.
      console.warn(
        '[WebhookService] WEBHOOK_SECRET not set — skipping verification',
      );
      return true;
    }

    let incomingHex = signatureHeader;

    // Some providers prefix with "sha256=" — strip it
    if (incomingHex.startsWith('sha256=')) {
      incomingHex = incomingHex.slice(7);
    }

    const expected = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    try {
      return crypto.timingSafeEqual(
        Buffer.from(expected, 'hex'),
        Buffer.from(incomingHex, 'hex'),
      );
    } catch {
      return false; // Lengths differ
    }
  }

  // ─── Core handler ─────────────────────────────────────────────────────────

  /**
   * Process a single payment event delivered by the webhook.
   *
   * Delegates all state transitions to TransactionStateMachine, which
   * enforces the allowed-transition table and prevents illegal moves
   * (e.g. re-confirming an already-confirmed transaction).
   */
  static async handlePaymentEvent(
    event: WebhookPaymentEvent,
  ): Promise<WebhookProcessResult> {
    const { txHash, status, blockNumber, confirmations } = event;

    // Check if a transaction record exists for this hash
    const tx = await Transaction.findOne({ transactionId: txHash });

    if (!tx) {
      // No pending transaction found — either already processed elsewhere
      // or this webhook arrived before the user submitted the payment.
      return {
        processed: false,
        message: `No transaction record found for hash: ${txHash}`,
      };
    }

    // Map webhook status to a state machine event
    const smEvent: TransactionEvent =
      status === 'confirmed' ? 'CHAIN_CONFIRMED' : 'CHAIN_FAILED';

    try {
      const result = await TransactionStateMachine.apply(smEvent, {
        txHash,
        blockNumber,
        confirmations,
        triggeredBy: 'webhook',
      });

      return {
        processed: result.transitioned,
        message: result.message,
      };
    } catch (error) {
      // TransactionStateError means the tx is already in a terminal state —
      // this is expected for duplicate webhook deliveries, not a real error.
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`[WebhookService] State transition rejected: ${msg}`);
      return {
        processed: false,
        message: msg,
      };
    }
  }

  // ─── Provider adapters ────────────────────────────────────────────────────

  /**
   * Map an Alchemy "mined transaction" webhook payload to our internal shape.
   * Add more adapters here as you onboard new providers.
   */
  static fromAlchemyPayload(body: any): WebhookPaymentEvent | null {
    try {
      const activity = body?.event?.activity?.[0];
      if (!activity) return null;
      return {
        txHash: activity.hash,
        from: activity.fromAddress,
        to: activity.toAddress,
        valueWei: activity.rawContract?.rawValue ?? '0',
        blockNumber: activity.blockNum,
        confirmations: 0, // Alchemy notifies on 0-conf; reconciliation handles final state
        status: 'confirmed',
        timestamp: Math.floor(Date.now() / 1000),
      };
    } catch {
      return null;
    }
  }
}
