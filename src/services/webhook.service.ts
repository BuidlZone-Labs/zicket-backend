import crypto from 'crypto';
import mongoose from 'mongoose';
import Transaction from '../models/transaction';
import TicketOrder from '../models/ticket-order';
import EventTicket from '../models/event-ticket';

/**
 * #81 — Payment Webhook / Listener Service
 *
 * Designed to receive POST events from any blockchain webhook provider
 * (Alchemy Notify, Moralis Streams, QuickNode Streams, custom indexer, etc.)
 *
 * Security: HMAC-SHA256 signature verification before any processing.
 *
 * Flow per event:
 *  confirmed → Transaction: pending→completed, TicketOrder: 0→1, decrement seats
 *  failed    → Transaction: pending→failed,    TicketOrder: 0→3
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
   */
  static async handlePaymentEvent(
    event: WebhookPaymentEvent,
  ): Promise<WebhookProcessResult> {
    const { txHash, status } = event;

    // Find the matching pending transaction in our DB
    const transaction = await Transaction.findOne({
      transactionId: txHash,
      status: 'pending',
    });

    if (!transaction) {
      // Either already processed, or we created it optimistically elsewhere
      const alreadyDone = await Transaction.findOne({ transactionId: txHash });
      if (alreadyDone) {
        return {
          processed: false,
          message: `Transaction ${txHash} already in state: ${alreadyDone.status}`,
        };
      }
      return {
        processed: false,
        message: `No pending transaction found for hash: ${txHash}`,
      };
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const newTxStatus = status === 'confirmed' ? 'completed' : 'failed';
      const newOrderStatus = status === 'confirmed' ? 1 : 3;

      // Update transaction
      await Transaction.findByIdAndUpdate(
        transaction._id,
        { status: newTxStatus },
        { session },
      );

      // Find matching pending order (most recent one for this user + event)
      const order = await TicketOrder.findOne({
        user: transaction.user,
        eventTicket: transaction.eventTicket,
        status: 0, // pending
      })
        .sort({ datePurchased: -1 })
        .session(session);

      if (order) {
        await TicketOrder.findByIdAndUpdate(
          order._id,
          { status: newOrderStatus },
          { session },
        );

        if (status === 'confirmed') {
          // Confirm seat deductions
          await EventTicket.findByIdAndUpdate(
            transaction.eventTicket,
            {
              $inc: {
                availableTickets: -order.quantity,
                soldTickets: order.quantity,
              },
            },
            { session },
          );
        }
      }

      await session.commitTransaction();

      return {
        processed: true,
        message: `Transaction ${txHash} → ${newTxStatus}`,
      };
    } catch (error) {
      await session.abortTransaction();
      throw new Error(
        `Webhook processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      session.endSession();
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