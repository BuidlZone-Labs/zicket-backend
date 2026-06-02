import Transaction from '../models/transaction';
import { BlockchainProvider } from '../provider/blockchain.provider';
import {
  TransactionStateMachine,
  TransactionEvent,
} from '../state-machine/transaction.state-machine';

/**
 * #78 #80 — Blockchain Transaction Reconciliation Service
 *
 * Runs as a periodic BullMQ job (see workers/reconciliation.worker.ts).
 * Finds any pending Transaction that's been sitting for longer than
 * RECONCILIATION_STALE_MINUTES, re-checks its on-chain status, and
 * delegates fixes to TransactionStateMachine.
 *
 * All state transitions go through the state machine — no direct DB writes here.
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
    const minConfirmations = blockchain.getMinConfirmations();

    for (const tx of pendingTxs) {
      try {
        const chainTx = await blockchain.fetchTransaction(tx.transactionId);

        // Derive the correct state machine event from the chain result
        const isStale = true; // These are already past the stale threshold
        const smEvent: TransactionEvent = TransactionStateMachine.deriveEvent(
          chainTx ? chainTx.status : null,
          chainTx?.confirmations ?? 0,
          minConfirmations,
          isStale,
        );

        // CHAIN_PENDING = no state change needed
        if (smEvent === 'CHAIN_PENDING') {
          report.skipped++;
          continue;
        }

        // Apply the transition via state machine
        const result = await TransactionStateMachine.apply(smEvent, {
          txHash: tx.transactionId,
          blockNumber: chainTx?.blockNumber ?? undefined,
          confirmations: chainTx?.confirmations ?? 0,
          triggeredBy: 'reconciliation',
        });

        if (result.transitioned) {
          if (result.newState === 'confirmed') {
            report.confirmed++;
          } else {
            report.failed++;
          }
          console.log(
            `[Reconciliation] tx ${tx.transactionId} → ${result.newState}`,
          );
        } else {
          report.skipped++;
        }
      } catch (error) {
        const msg = `Failed to reconcile tx ${tx.transactionId}: ${error instanceof Error ? error.message : 'Unknown'}`;
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
