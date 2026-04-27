import mongoose from 'mongoose';
import Transaction from '../models/transaction';
import TicketOrder from '../models/ticket-order';
import { BlockchainProvider } from '../provider/blockchain.provider';
import InventoryService from './inventory.service';

/**
 * #78 #80 — Blockchain Transaction Reconciliation Service with Inventory Locking
 *
 * Runs as a periodic BullMQ job (see workers/reconciliation.worker.ts).
 * Finds any pending Transaction that's been sitting for longer than
 * RECONCILIATION_STALE_MINUTES, re-checks its on-chain status, and
 * fixes the DB if the chain disagrees.
 *
 * Handles:
 *  - tx confirmed on chain but DB still says pending
 *  - tx failed/dropped on chain, DB still says pending
 *  - tx not found on chain after a long wait (treat as failed)
 */

const STALE_MINUTES = parseInt(
  process.env.RECONCILIATION_STALE_MINUTES || '30',
  10,
);

export interface ReconciliationReport {
  scanned: number;
  confirmed: number;
  failed: number;
  skipped: number;
  errors: string[];
  durationMs: number;
}

export class ReconciliationService {
  static async reconcilePendingTransactions(): Promise<ReconciliationReport> {
    const startTime = Date.now();

    const report: ReconciliationReport = {
      scanned: 0,
      confirmed: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      durationMs: 0,
    };

    const staleThreshold = new Date(Date.now() - STALE_MINUTES * 60 * 1000);

    // Only target transactions that have been pending for a while
    const pendingTxs = await Transaction.find({
      status: 'pending',
      transactionDate: { $lte: staleThreshold },
    })
      .lean()
      .limit(200); // Safety cap — avoids runaway queries

    report.scanned = pendingTxs.length;

    if (pendingTxs.length === 0) {
      report.durationMs = Date.now() - startTime;
      return report;
    }

    console.log(
      `[Reconciliation] Scanning ${pendingTxs.length} stale pending transactions...`,
    );

    const blockchain = BlockchainProvider.getInstance();

    for (const tx of pendingTxs) {
      try {
        const chainTx = await blockchain.fetchTransaction(tx.transactionId);

        // ── Case 1: Not found on chain yet ────────────────────────────────
        if (!chainTx) {
          // Could be not yet propagated, or dropped. Skip for now —
          // a separate "expired" cleanup job can handle very old ones.
          report.skipped++;
          continue;
        }

        // ── Case 2: Still pending on chain ────────────────────────────────
        if (chainTx.status === 'pending') {
          report.skipped++;
          continue;
        }

        // ── Case 3: Terminal state (confirmed or failed) ──────────────────
        const newTxStatus =
          chainTx.status === 'confirmed' ? 'completed' : 'failed';
        const newOrderStatus = chainTx.status === 'confirmed' ? 1 : 3;

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
          await Transaction.findByIdAndUpdate(
            tx._id,
            { status: newTxStatus },
            { session },
          );

          const order = await TicketOrder.findOne({
            user: tx.user,
            eventTicket: tx.eventTicket,
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

            if (chainTx.status === 'confirmed') {
              // #80: Confirm inventory deduction using atomic operation
              const confirmResult = await InventoryService.confirmInventoryDeduction(
                tx.eventTicket.toString(),
                order.quantity,
                session,
              );

              if (!confirmResult.success) {
                console.warn(
                  `[ReconciliationService] Inventory confirmation issue for order ${order._id}: ${confirmResult.error}`,
                );
              }
              report.confirmed++;
            } else {
              report.failed++;
            }
          } else {
            // No matching order — just fix the transaction record
            if (chainTx.status === 'confirmed') report.confirmed++;
            else report.failed++;
          }

          await session.commitTransaction();
          console.log(
            `[Reconciliation] tx ${tx.transactionId} → ${newTxStatus}`,
          );
        } catch (innerErr) {
          await session.abortTransaction();
          const msg = `Failed to fix tx ${tx.transactionId}: ${innerErr instanceof Error ? innerErr.message : 'Unknown'}`;
          report.errors.push(msg);
          console.error(`[Reconciliation] ${msg}`);
        } finally {
          session.endSession();
        }
      } catch (outerErr) {
        const msg = `Chain check failed for tx ${tx.transactionId}: ${outerErr instanceof Error ? outerErr.message : 'Unknown'}`;
        report.errors.push(msg);
        console.error(`[Reconciliation] ${msg}`);
      }
    }

    report.durationMs = Date.now() - startTime;

    console.log(
      `[Reconciliation] Done in ${report.durationMs}ms — ` +
        `confirmed: ${report.confirmed}, failed: ${report.failed}, ` +
        `skipped: ${report.skipped}, errors: ${report.errors.length}`,
    );

    return report;
  }
}
