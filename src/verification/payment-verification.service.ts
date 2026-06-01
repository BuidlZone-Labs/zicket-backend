import mongoose from 'mongoose';
import Transaction from '../models/transaction';
import TicketOrder from '../models/ticket-order';
import EventTicket from '../models/event-ticket';
import User from '../models/user';
import InventoryService from '../services/inventory.service';
import { PaymentVerificationService as Verifier } from '../services/paymentVerification.service';
import {
  TransactionStateMachine,
} from '../state-machine/transaction.state-machine';

/**
 * Orchestrates payment verification (delegated to PaymentVerificationService)
 * followed by atomic, lock-protected ticket issuance.
 *
 * Flow:
 *  1. Validate event existence + availability
 *  2. Privacy enforcement
 *  3. Delegate on-chain verification to PaymentVerificationService.verify()
 *     — replay protection, finality, recipient, value checks all happen there
 *  4. Create Transaction (pending) + TicketOrder (pending) atomically
 *  5. Apply CHAIN_CONFIRMED via TransactionStateMachine → moves both to terminal state
 */

export interface VerificationResult {
  success: boolean;
  transactionId?: string;
  orderId?: string;
  message: string;
  isRetry?: boolean; // indicates if this was a retry of a successful payment
}

export class PaymentVerificationService {
  /**
   * Verify an on-chain transaction and issue a ticket if everything checks out.
   * Supports idempotency for safe retries.
   *
   * @param txHash             Blockchain transaction hash submitted by the user
   * @param userId             Authenticated user's MongoDB ID
   * @param eventTicketId      The event being purchased
   * @param ticketType         e.g. "VIP", "General"
   * @param quantity           Number of tickets requested
   * @param expectedAmountUsd  Amount we expect to have been paid (stored in DB)
   * @param idempotencyKey     Optional idempotency key for duplicate prevention
   */
  static async verifyAndIssueTicket(
    txHash: string,
    userId: string,
    eventTicketId: string,
    ticketType: string,
    quantity: number,
    expectedAmountUsd: number,
    idempotencyKey?: string,
  ): Promise<VerificationResult> {
    // ── 1. Idempotency guard: check if this request was already processed ─────
    if (idempotencyKey) {
      const existingByKey = await Transaction.findOne({ idempotencyKey });
      if (existingByKey) {
        // Same idempotency key was used before — return the cached result
        const order = await TicketOrder.findOne({
          idempotencyKey,
        });
        return {
          success: true,
          transactionId: (existingByKey._id as any).toString(),
          orderId: (order?._id as any).toString(),
          message: 'Payment already verified for this request (idempotency match)',
          isRetry: true,
        };
      }
    }

    // ── 2. Replay guard: check by txHash ──────────────────────────────────────
    const existing = await Transaction.findOne({ transactionId: txHash });
    if (existing) {
      // txHash was already processed — reject to prevent double charge.
      return {
        success: false,
        message: 'Transaction already processed (txHash replay detected)',
      };
    }

    // ── 3. Event existence + availability ────────────────────────────────────
    const event = await EventTicket.findById(eventTicketId);
    if (!event) {
      return { success: false, message: 'Event not found' };
    }

    // ── 4. Privacy enforcement ────────────────────────────────────────────────
    if (!event.allowAnonymous || event.requiresVerification) {
      const isUserIdValid = mongoose.isValidObjectId(userId);
      const user = isUserIdValid
        ? await User.findById(userId).select('emailVerifiedAt').lean()
        : null;

      if (!event.allowAnonymous && !user) {
        return {
          success: false,
          message: 'Authentication required to purchase tickets for this event',
        };
      }

      if (event.requiresVerification && !user?.emailVerifiedAt) {
        return {
          success: false,
          message:
            'Email verification required to purchase tickets for this event',
        };
      }
    }

    // ── 5. On-chain verification ──────────────────────────────────────────────
    let chainResult;
    try {
      chainResult = await Verifier.verify({
        txHash,
        expectedAmountUsd,
        orderRef: eventTicketId,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Verification failed';

      if (message.toLowerCase().includes('not found on chain')) {
        return { success: false, message: 'Transaction not found on chain' };
      }

      return { success: false, message };
    }

    // ── 6. Atomic: reserve inventory + create pending records ────────────────
    const session = await mongoose.startSession();
    session.startTransaction();

    let transaction: any;
    let order: any;

    try {
      // Reserve inventory atomically with distributed locking
      const inventoryResult =
        await InventoryService.reserveInventoryTransactional(
          eventTicketId,
          quantity,
          session,
        );

      if (!inventoryResult.success) {
        await session.abortTransaction();
        return {
          success: false,
          message: inventoryResult.error || 'Failed to reserve tickets',
        };
      }

      // Create Transaction in 'pending' state — state machine will confirm it
      [transaction] = await Transaction.create(
        [
          {
            user: new mongoose.Types.ObjectId(userId),
            eventTicket: new mongoose.Types.ObjectId(eventTicketId),
            amount: expectedAmountUsd,
            transactionDate: new Date(),
            status: 'pending',
            transactionId: txHash,
            idempotencyKey: idempotencyKey || undefined,
            confirmations: chainResult.confirmations,
          },
        ],
        { session },
      );

      // Create TicketOrder in pending state (status: 0)
      [order] = await TicketOrder.create(
        [
          {
            user: new mongoose.Types.ObjectId(userId),
            eventTicket: new mongoose.Types.ObjectId(eventTicketId),
            ticketType,
            eventName: event.name,
            status: 0, // pending — state machine will move to 1
            quantity,
            amount: expectedAmountUsd,
            zkIdMatch: false,
            privacyLevel: String(event.privacyLevel),
            hasReceipt: event.offerReceipts ?? false,
            datePurchased: new Date(),
            idempotencyKey: idempotencyKey || undefined,
          },
        ],
        { session },
      );

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

    // ── 7. Confirm via state machine (outside the creation session) ───────────
    // The on-chain verification already passed, so we apply CHAIN_CONFIRMED.
    // If this step fails, the reconciliation job will pick it up and retry.
    try {
      await TransactionStateMachine.apply('CHAIN_CONFIRMED', {
        txHash,
        confirmations: chainResult.confirmations,
        triggeredBy: 'direct',
      });
    } catch (smError) {
      // Log but don't fail the request — the records exist and reconciliation
      // will fix the state on the next run.
      console.error(
        `[PaymentVerificationService] State machine confirmation failed for ${txHash}:`,
        smError,
      );
    }

    return {
      success: true,
      transactionId: (transaction._id as any).toString(),
      orderId: (order._id as any).toString(),
      message: 'Payment verified and ticket issued successfully',
    };
  }
}
