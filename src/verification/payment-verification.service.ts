import mongoose from 'mongoose';
import Transaction from '../models/transaction';
import TicketOrder from '../models/ticket-order';
import EventTicket from '../models/event-ticket';
import User from '../models/user';
import { BlockchainProvider } from '../provider/blockchain.provider';

/**
 * #75 — Wallet Payment Verification
 *
 * Flow:
 *  1. Guard against replay (duplicate txHash)
 *  2. Confirm event exists + has enough available tickets
 *  3. Fetch tx from chain, check confirmations & recipient
 *  4. Atomically create Transaction + TicketOrder + decrement availability
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
      // Warn: txHash was already processed but with a different idempotency key
      // This could indicate an attack or network retry. Still reject to prevent double charge.
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
    if (event.availableTickets < quantity) {
      return {
        success: false,
        message: `Only ${event.availableTickets} ticket(s) remaining`,
      };
    }

    // ── 2b. Privacy enforcement ───────────────────────────────────────────────
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

    // ── 4. On-chain verification ──────────────────────────────────────────────
    const blockchain = BlockchainProvider.getInstance();
    const chainTx = await blockchain.fetchTransaction(txHash);

    if (!chainTx) {
      return { success: false, message: 'Transaction not found on chain' };
    }

    if (chainTx.status === 'failed') {
      return { success: false, message: 'Transaction failed on chain' };
    }

    if (chainTx.status === 'pending') {
      return {
        success: false,
        message: `Transaction is still pending (0 confirmations). Please try again shortly.`,
      };
    }

    if (chainTx.confirmations < blockchain.getMinConfirmations()) {
      return {
        success: false,
        message: `Transaction needs ${blockchain.getMinConfirmations()} confirmations, currently has ${chainTx.confirmations}`,
      };
    }

    // Ensure payment was sent to the platform wallet, not a random address
    if (chainTx.to !== blockchain.getPlatformWallet()) {
      return {
        success: false,
        message: 'Payment was not sent to the platform wallet',
      };
    }

    // ── 5. Atomic DB writes ───────────────────────────────────────────────────
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Create completed transaction record with idempotency key
      const [transaction] = await Transaction.create(
        [
          {
            user: new mongoose.Types.ObjectId(userId),
            eventTicket: new mongoose.Types.ObjectId(eventTicketId),
            amount: expectedAmountUsd,
            transactionDate: new Date(),
            status: 'completed',
            transactionId: txHash,
            idempotencyKey: idempotencyKey || undefined,
          },
        ],
        { session },
      );

      // Create completed ticket order with idempotency key
      const [order] = await TicketOrder.create(
        [
          {
            user: new mongoose.Types.ObjectId(userId),
            eventTicket: new mongoose.Types.ObjectId(eventTicketId),
            ticketType,
            eventName: event.name,
            status: 1, // completed
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

      // Decrement available / increment sold (atomic)
      await EventTicket.findByIdAndUpdate(
        eventTicketId,
        { $inc: { availableTickets: -quantity, soldTickets: quantity } },
        { session },
      );

      await session.commitTransaction();

      return {
        success: true,
        transactionId: (transaction._id as any).toString(),
        orderId: (order._id as any).toString(),
        message: 'Payment verified and ticket issued successfully',
      };
    } catch (error) {
      await session.abortTransaction();
      throw new Error(
        `Payment verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      session.endSession();
    }
  }
}
