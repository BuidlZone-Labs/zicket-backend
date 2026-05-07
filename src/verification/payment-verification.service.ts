import mongoose from 'mongoose';
import Transaction from '../models/transaction';
import TicketOrder from '../models/ticket-order';
import EventTicket from '../models/event-ticket';
import User from '../models/user';
import InventoryService from '../services/inventory.service';
import { PaymentVerificationService as Verifier } from '../services/paymentVerification.service';

/**
 * Orchestrates payment verification (delegated to PaymentVerificationService)
 * followed by atomic, lock-protected ticket issuance.
 *
 * Flow:
 *  1. Validate event existence + availability
 *  2. Privacy enforcement
 *  3. Delegate on-chain verification to PaymentVerificationService.verify()
 *     — replay protection, finality, recipient, value checks all happen there
 *  4. Atomically reserve inventory, then create Transaction + TicketOrder
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
    // ── 1. Event existence + availability ────────────────────────────────────
    const event = await EventTicket.findById(eventTicketId);
    if (!event) {
      return { success: false, message: 'Event not found' };
    }

    // ── 2. Privacy enforcement ────────────────────────────────────────────────
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
    // Normalize delegated verifier failures to stable API messages.
    try {
      await Verifier.verify({
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

    // ── 4. Atomic inventory reservation + DB writes ─────────────────────────
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // #80: Reserve inventory atomically with distributed locking
      // This prevents race conditions and ensures no overselling
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

      const [order] = await TicketOrder.create(
        [
          {
            user: new mongoose.Types.ObjectId(userId),
            eventTicket: new mongoose.Types.ObjectId(eventTicketId),
            ticketType,
            eventName: event.name,
            status: 1,
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
      throw error;
    } finally {
      session.endSession();
    }
  }
}
