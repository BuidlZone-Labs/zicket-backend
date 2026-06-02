import { RequestHandler } from 'express';
import Transaction from '../models/transaction';
import TicketOrder from '../models/ticket-order';
import { TransactionStateMachine } from '../state-machine/transaction.state-machine';
import { UserAuthenticatedReq } from '../utils/types';

/**
 * GET /ticket-orders/transaction-status/:txHash
 *
 * Returns the current state of a blockchain transaction and its associated
 * ticket order. Designed for frontend polling — returns a stable shape
 * regardless of which state the transaction is in.
 *
 * Response shape:
 * {
 *   txHash: string
 *   state: 'pending' | 'confirmed' | 'failed'
 *   orderStatus: 0 | 1 | 3          // mirrors TicketOrder.status
 *   blockNumber: number | null
 *   confirmations: number
 *   lastCheckedAt: string | null     // ISO timestamp
 *   orderId: string | null
 *   isTerminal: boolean              // true when no further changes expected
 * }
 */
export const getTransactionStatus: RequestHandler = async (
  req: UserAuthenticatedReq,
  res,
) => {
  try {
    const userId = req.user?._id || (req.user as any)?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User authentication required',
      });
    }

    const { txHash } = req.params as { txHash: string };

    if (!txHash || typeof txHash !== 'string' || txHash.trim() === '') {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'txHash is required',
      });
    }

    // Fetch transaction — scoped to the authenticated user for security
    const tx = await Transaction.findOne({
      transactionId: txHash.trim(),
      user: userId,
    }).lean();

    if (!tx) {
      return res.status(404).json({
        error: 'Not found',
        message: `No transaction found for hash: ${txHash}`,
      });
    }

    const currentState = tx.status as 'pending' | 'confirmed' | 'failed';

    // Find the associated ticket order
    const order = await TicketOrder.findOne({
      user: tx.user,
      eventTicket: tx.eventTicket,
    })
      .sort({ datePurchased: -1 })
      .select('_id status')
      .lean();

    // A state is terminal when no further transitions are possible
    const isTerminal = currentState === 'confirmed' || currentState === 'failed';

    return res.status(200).json({
      success: true,
      data: {
        txHash: tx.transactionId,
        state: currentState,
        orderStatus: TransactionStateMachine.toOrderStatus(currentState),
        blockNumber: tx.blockNumber ?? null,
        confirmations: tx.confirmations ?? 0,
        lastCheckedAt: tx.lastCheckedAt?.toISOString() ?? null,
        orderId: order ? (order._id as any).toString() : null,
        isTerminal,
      },
    });
  } catch (error) {
    console.error('[TransactionStatusController] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to fetch transaction status',
    });
  }
};
