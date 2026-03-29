import mongoose from 'mongoose';
import Transaction from '../models/transaction';
import TicketOrder from '../models/ticket-order';
import EventTicket from '../models/event-ticket';
import { BlockchainProvider } from './blockchain.provider';

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
}

export class PaymentVerificationService {
  /**
   * Verify an on-chain transaction and issue a ticket if everything checks out.
   *
   * @param txHash             Blockchain transaction hash submitted by the user
   * @param userId             Authenticated user's MongoDB ID
   * @param eventTicketId      The event being purchased
   * @param ticketType         e.g. "VIP", "General"
   * @param quantity           Number of tickets requested
   * @param expectedAmountUsd  Amount we expect to have been paid (stored in DB)
   */
  static async verifyAndIssueTicket(
    txHash: string,
    userId: string,
    eventTicketId: string,
    ticketType: string,
    quantity: number,
    expectedAmountUsd: number,
  ): Promise<VerificationResult> {
    // ── 1. Replay guard ───────────────────────────────────────────────────────
    const existing = await Transaction.findOne({ transactionId: txHash });
    if (existing) {
      return { success: false, message: 'Transaction already processed' };
    }

    // ── 2. Event existence + availability ────────────────────────────────────
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

    // ── 3. On-chain verification ──────────────────────────────────────────────
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

    // ── 4. Atomic DB writes ───────────────────────────────────────────────────
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Create completed transaction record
      const [transaction] = await Transaction.create(
        [
          {
            user: new mongoose.Types.ObjectId(userId),
            eventTicket: new mongoose.Types.ObjectId(eventTicketId),
            amount: expectedAmountUsd,
            transactionDate: new Date(),
            status: 'completed',
            transactionId: txHash,
          },
        ],
        { session },
      );

      // Create completed ticket order
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