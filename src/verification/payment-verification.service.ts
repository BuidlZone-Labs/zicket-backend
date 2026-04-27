import mongoose from 'mongoose';
import Transaction from '../models/transaction';
import TicketOrder from '../models/ticket-order';
import EventTicket from '../models/event-ticket';
import User from '../models/user';
import { BlockchainProvider } from '../provider/blockchain.provider';
import InventoryService from '../services/inventory.service';

/**
 * #75 #80 — Wallet Payment Verification with Distributed Inventory Locking
 *
 * Flow:
 *  1. Guard against replay (duplicate txHash)
 *  2. Confirm event exists
 *  3. Fetch tx from chain, check confirmations & recipient
 *  4. Atomically reserve inventory, create Transaction + TicketOrder
 *
 * Uses atomic findOneAndUpdate with $gte condition to prevent overselling.
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

    // ── 2. Event existence ──────────────────────────────────────────────────
    const event = await EventTicket.findById(eventTicketId);
    if (!event) {
      return { success: false, message: 'Event not found' };
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

    // ── 4. Atomic inventory reservation + DB writes ─────────────────────────
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // #80: Reserve inventory atomically with distributed locking
      // This prevents race conditions and ensures no overselling
      const inventoryResult = await InventoryService.reserveInventory(
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
