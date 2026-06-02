import mongoose from 'mongoose';
import Transaction, { ITransaction } from '../models/transaction';
import TicketOrder from '../models/ticket-order';
import InventoryService from '../services/inventory.service';
import { TransactionStateError } from '../errors/AppError';

// ─── State & Event Definitions ────────────────────────────────────────────────

/**
 * Canonical blockchain transaction states.
 * These map 1-to-1 with Transaction.status in the DB.
 */
export type TransactionState = 'pending' | 'confirmed' | 'failed';

/**
 * Events that drive state transitions.
 *
 *  CHAIN_CONFIRMED  — on-chain receipt shows status=1 and confirmations >= MIN
 *  CHAIN_FAILED     — on-chain receipt shows status=0 (reverted)
 *  CHAIN_DROPPED    — tx not found after stale timeout (treat as failed)
 *  CHAIN_PENDING    — tx found but not yet mined / under-confirmed (no-op)
 */
export type TransactionEvent =
  | 'CHAIN_CONFIRMED'
  | 'CHAIN_FAILED'
  | 'CHAIN_DROPPED'
  | 'CHAIN_PENDING';

/**
 * Context passed into every transition.
 */
export interface TransitionContext {
  txHash: string;
  blockNumber?: number;
  confirmations?: number;
  /** Source that triggered the transition: webhook, reconciliation, or direct verify */
  triggeredBy: 'webhook' | 'reconciliation' | 'direct';
}

/**
 * Result returned after a transition attempt.
 */
export interface TransitionResult {
  /** Whether the state actually changed */
  transitioned: boolean;
  previousState: TransactionState;
  newState: TransactionState;
  message: string;
}

// ─── Allowed Transitions ─────────────────────────────────────────────────────

/**
 * Adjacency map: state → set of events that are valid from that state.
 *
 * Terminal states (confirmed, failed) accept no further transitions —
 * this is the core guard against false confirmations and double-processing.
 */
const ALLOWED_TRANSITIONS: Record<TransactionState, Set<TransactionEvent>> = {
  pending: new Set(['CHAIN_CONFIRMED', 'CHAIN_FAILED', 'CHAIN_DROPPED', 'CHAIN_PENDING']),
  confirmed: new Set(), // terminal — no transitions allowed
  failed: new Set(),    // terminal — no transitions allowed
};

/**
 * Map event → resulting state (only for state-changing events).
 */
const EVENT_TO_STATE: Partial<Record<TransactionEvent, TransactionState>> = {
  CHAIN_CONFIRMED: 'confirmed',
  CHAIN_FAILED: 'failed',
  CHAIN_DROPPED: 'failed',
  // CHAIN_PENDING is a no-op — state stays 'pending'
};

// ─── State Machine ────────────────────────────────────────────────────────────

export class TransactionStateMachine {
  /**
   * Apply an event to a transaction identified by txHash.
   *
   * Guards:
   *  - Rejects transitions from terminal states (no false confirmations)
   *  - Rejects unknown events
   *  - All DB writes happen inside a single MongoDB session/transaction
   *
   * Side-effects on CHAIN_CONFIRMED:
   *  - Transaction.status → 'confirmed'
   *  - TicketOrder.status → 1 (completed)
   *  - Inventory deduction confirmed
   *
   * Side-effects on CHAIN_FAILED / CHAIN_DROPPED:
   *  - Transaction.status → 'failed'
   *  - TicketOrder.status → 3 (failed)
   *  - Inventory released back to pool
   *
   * @throws TransactionStateError for illegal transitions
   */
  static async apply(
    event: TransactionEvent,
    ctx: TransitionContext,
  ): Promise<TransitionResult> {
    const { txHash, blockNumber, confirmations, triggeredBy } = ctx;

    // ── Load transaction ──────────────────────────────────────────────────────
    const tx = await Transaction.findOne({ transactionId: txHash });

    if (!tx) {
      throw new TransactionStateError(
        `No transaction found for txHash: ${txHash}`,
        txHash,
        'unknown' as TransactionState,
        event,
      );
    }

    const currentState = tx.status as TransactionState;

    // ── Guard: terminal state check ───────────────────────────────────────────
    const allowed = ALLOWED_TRANSITIONS[currentState];
    if (!allowed) {
      throw new TransactionStateError(
        `Unknown current state "${currentState}" for tx ${txHash}`,
        txHash,
        currentState,
        event,
      );
    }

    if (!allowed.has(event)) {
      // Illegal transition — this is the "no false confirmations" guard
      throw new TransactionStateError(
        `Cannot apply event "${event}" to transaction in state "${currentState}". ` +
          `Transaction ${txHash} is already in a terminal state.`,
        txHash,
        currentState,
        event,
      );
    }

    // ── No-op events (CHAIN_PENDING) ──────────────────────────────────────────
    const targetState = EVENT_TO_STATE[event];
    if (!targetState) {
      return {
        transitioned: false,
        previousState: currentState,
        newState: currentState,
        message: `Event "${event}" is a no-op for tx ${txHash} (still pending on chain)`,
      };
    }

    // ── Execute transition inside a DB session ────────────────────────────────
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Update transaction record
      await Transaction.findByIdAndUpdate(
        tx._id,
        {
          status: targetState,
          ...(blockNumber !== undefined && { blockNumber }),
          ...(confirmations !== undefined && { confirmations }),
          lastCheckedAt: new Date(),
        },
        { session },
      );

      // Find the matching pending TicketOrder
      const order = await TicketOrder.findOne({
        user: tx.user,
        eventTicket: tx.eventTicket,
        status: 0, // pending
      })
        .sort({ datePurchased: -1 })
        .session(session);

      if (order) {
        const newOrderStatus = targetState === 'confirmed' ? 1 : 3;

        await TicketOrder.findByIdAndUpdate(
          order._id,
          { status: newOrderStatus },
          { session },
        );

        if (targetState === 'confirmed') {
          // Confirm inventory deduction (validates consistency)
          const confirmResult = await InventoryService.confirmInventoryDeduction(
            tx.eventTicket.toString(),
            order.quantity,
            session,
          );

          if (!confirmResult.success) {
            console.warn(
              `[StateMachine] Inventory confirmation issue for order ${order._id}: ${confirmResult.error}`,
            );
          }
        } else {
          // Release inventory back to pool on failure
          const releaseResult = await InventoryService.releaseInventory(
            tx.eventTicket.toString(),
            order.quantity,
            session,
          );

          if (!releaseResult.success) {
            console.warn(
              `[StateMachine] Inventory release issue for order ${order._id}: ${releaseResult.error}`,
            );
          }
        }
      }

      await session.commitTransaction();

      console.info(
        `[StateMachine] tx=${txHash} ${currentState} → ${targetState} ` +
          `(event=${event}, triggeredBy=${triggeredBy})`,
      );

      return {
        transitioned: true,
        previousState: currentState,
        newState: targetState,
        message: `Transaction ${txHash} transitioned from "${currentState}" to "${targetState}" via "${event}"`,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Convenience: check whether a transition is valid without executing it.
   */
  static canApply(currentState: TransactionState, event: TransactionEvent): boolean {
    return ALLOWED_TRANSITIONS[currentState]?.has(event) ?? false;
  }

  /**
   * Derive the correct TransactionEvent from a raw chain status + confirmation count.
   *
   * @param chainStatus   Status returned by BlockchainProvider.fetchTransaction()
   * @param confirmations Number of confirmations on chain
   * @param minConfirmations Minimum required confirmations
   * @param isStale       Whether the transaction has exceeded the stale timeout
   */
  static deriveEvent(
    chainStatus: 'pending' | 'confirmed' | 'failed' | null,
    confirmations: number,
    minConfirmations: number,
    isStale = false,
  ): TransactionEvent {
    if (chainStatus === null) {
      // Not found on chain
      return isStale ? 'CHAIN_DROPPED' : 'CHAIN_PENDING';
    }

    if (chainStatus === 'failed') {
      return 'CHAIN_FAILED';
    }

    if (chainStatus === 'confirmed' && confirmations >= minConfirmations) {
      return 'CHAIN_CONFIRMED';
    }

    // confirmed on chain but under-confirmed, or still pending
    return 'CHAIN_PENDING';
  }

  /**
   * Map our internal TransactionState to the numeric TicketOrder status
   * for frontend consumption.
   */
  static toOrderStatus(state: TransactionState): number {
    switch (state) {
      case 'confirmed': return 1;
      case 'failed':    return 3;
      case 'pending':
      default:          return 0;
    }
  }
}
