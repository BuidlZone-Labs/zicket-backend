import Transaction from '../models/transaction';
import EventTicket from '../models/event-ticket';
import { BlockchainProvider } from '../provider/blockchain.provider';
import {
  getPaymentsContractProvider,
  isPaymentsContractConfigured,
} from '../provider/payments-contract.provider';
import {
  TransactionStateMachine,
  TransactionEvent,
} from '../state-machine/transaction.state-machine';
import logger from '../utils/logger';

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
  cancelledEventsSynced: number;
  cancelledTransactionsUpdated: number;
  errors: string[];
  durationMs: number;
}

export class ReconciliationService {
  /**
   * Re-checks stale pending transactions on-chain and applies state-machine fixes.
   */
  static async reconcilePendingTransactions(): Promise<ReconciliationReport> {
    const startTime = Date.now();

    const report: ReconciliationReport = {
      scanned: 0,
      confirmed: 0,
      failed: 0,
      skipped: 0,
      cancelledEventsSynced: 0,
      cancelledTransactionsUpdated: 0,
      errors: [],
      durationMs: 0,
    };

    const staleThreshold = new Date(Date.now() - STALE_MINUTES * 60 * 1000);
    const isSoroban = isPaymentsContractConfigured();

    // If Soroban is enabled, we reconcile both pending transactions and recently failed ones (for late confirmations)
    // If not, we just query pending transactions older than the stale threshold
    let pendingTxs;
    if (isSoroban) {
      const failedThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
      pendingTxs = await Transaction.find({
        $or: [
          { status: 'pending' },
          { status: 'failed', transactionDate: { $gte: failedThreshold } },
        ],
      })
        .lean()
        .limit(200);
    } else {
      pendingTxs = await Transaction.find({
        status: 'pending',
        transactionDate: { $lte: staleThreshold },
      })
        .lean()
        .limit(200);
    }

    report.scanned = pendingTxs.length;

    if (pendingTxs.length === 0) {
      report.durationMs = Date.now() - startTime;
      return report;
    }

    logger.info(
      `[Reconciliation] Scanning ${pendingTxs.length} transactions (isSoroban: ${isSoroban})...`,
    );

    const blockchain = BlockchainProvider.getInstance();
    const minConfirmations = blockchain.getMinConfirmations();

    for (const tx of pendingTxs) {
      try {
        const isSorobanTx =
          isSoroban &&
          !tx.transactionId.startsWith('0x') &&
          !tx.transactionId.startsWith('0X');

        if (isSorobanTx) {
          const sorobanTx = await blockchain.fetchSorobanTransactionStatus(
            tx.transactionId,
          );

          if (sorobanTx.status === 'SUCCESS') {
            const result = await TransactionStateMachine.apply(
              'CHAIN_CONFIRMED',
              {
                txHash: tx.transactionId,
                blockNumber: sorobanTx.ledger,
                triggeredBy: 'reconciliation',
              },
            );
            if (result.transitioned) {
              report.confirmed++;
              logger.info(
                `[Reconciliation] tx ${tx.transactionId} → confirmed`,
              );
            } else {
              report.skipped++;
            }
          } else if (sorobanTx.status === 'FAILED') {
            const result = await TransactionStateMachine.apply('CHAIN_FAILED', {
              txHash: tx.transactionId,
              blockNumber: sorobanTx.ledger,
              triggeredBy: 'reconciliation',
            });
            if (result.transitioned) {
              report.failed++;
              logger.info(`[Reconciliation] tx ${tx.transactionId} → failed`);
            } else {
              report.skipped++;
            }
          } else if (sorobanTx.status === 'NOT_FOUND') {
            const txIsStale =
              tx.transactionDate.getTime() <= staleThreshold.getTime();
            if (txIsStale) {
              const result = await TransactionStateMachine.apply(
                'CHAIN_DROPPED',
                {
                  txHash: tx.transactionId,
                  triggeredBy: 'reconciliation',
                },
              );
              if (result.transitioned) {
                report.failed++;
                logger.info(
                  `[Reconciliation] tx ${tx.transactionId} → failed (dropped/stale)`,
                );
              } else {
                report.skipped++;
              }
            } else {
              report.skipped++;
            }
          }
        } else {
          // Original EVM behavior (only relevant for non-Soroban or EVM mock txs)
          const chainTx = await blockchain.fetchTransaction(tx.transactionId);

          // Derive the correct state machine event from the chain result
          const isStale = true; // These are already past the stale threshold for EVM
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
            logger.info(
              `[Reconciliation] tx ${tx.transactionId} → ${result.newState}`,
            );
          } else {
            report.skipped++;
          }
        }
      } catch (error) {
        const msg = `Failed to reconcile tx ${tx.transactionId}: ${error instanceof Error ? error.message : 'Unknown'}`;
        report.errors.push(msg);
        logger.error(`[Reconciliation] ${msg}`);
      }
    }

    report.durationMs = Date.now() - startTime;

    logger.info(
      `[Reconciliation] Done in ${report.durationMs}ms — ` +
        `confirmed: ${report.confirmed}, failed: ${report.failed}, ` +
        `skipped: ${report.skipped}, errors: ${report.errors.length}`,
    );

    return report;
  }

  /**
   * Sync proportional-cancellation financial state from the payments contract.
   * Reads withdrawable_ratio_bps directly from contract storage (never re-derived).
   */
  static async reconcileCancelledEventFinances(
    report?: ReconciliationReport,
  ): Promise<ReconciliationReport> {
    const startTime = Date.now();
    const localReport: ReconciliationReport = report ?? {
      scanned: 0,
      confirmed: 0,
      failed: 0,
      skipped: 0,
      cancelledEventsSynced: 0,
      cancelledTransactionsUpdated: 0,
      errors: [],
      durationMs: 0,
    };

    if (!isPaymentsContractConfigured()) {
      logger.warn(
        '[Reconciliation] Skipping cancelled-event sync — Soroban contract not configured',
      );
      return localReport;
    }

    const provider = getPaymentsContractProvider();

    const cancelledEvents = await EventTicket.find({
      eventStatus: 'cancelled',
      onChainEventId: { $exists: true, $nin: [null, ''] },
    })
      .lean()
      .limit(200);

    for (const event of cancelledEvents) {
      const onChainEventId = event.onChainEventId as string;

      try {
        const financialState =
          await provider.getEventFinancialState(onChainEventId);

        if (financialState.withdrawableRatioBps === null) {
          localReport.skipped++;
          continue;
        }

        await EventTicket.findByIdAndUpdate(event._id, {
          withdrawableRatioBps: financialState.withdrawableRatioBps,
          cancelLedger: financialState.cancelLedger,
          organizerWithdrawn: financialState.organizerWithdrawn,
        });

        localReport.cancelledEventsSynced++;

        const confirmedTxs = await Transaction.find({
          eventTicket: event._id,
          status: 'confirmed',
        }).lean();

        for (const tx of confirmedTxs) {
          try {
            const result = await TransactionStateMachine.apply(
              'EVENT_CANCELLED',
              {
                txHash: tx.transactionId,
                withdrawableRatioBps: financialState.withdrawableRatioBps,
                triggeredBy: 'reconciliation',
              },
            );

            if (result.transitioned) {
              localReport.cancelledTransactionsUpdated++;
            }
          } catch (error) {
            const msg = `Failed to cancel tx ${tx.transactionId} for event ${onChainEventId}: ${
              error instanceof Error ? error.message : 'Unknown'
            }`;
            localReport.errors.push(msg);
            logger.error(`[Reconciliation] ${msg}`);
          }
        }
      } catch (error) {
        const msg = `Failed to reconcile cancelled event ${onChainEventId}: ${
          error instanceof Error ? error.message : 'Unknown'
        }`;
        localReport.errors.push(msg);
        logger.error(`[Reconciliation] ${msg}`);
      }
    }

    localReport.durationMs = Date.now() - startTime;
    return localReport;
  }

  /**
   * Full reconciliation pass: stale pending txs + cancelled-event finances.
   */
  static async reconcileAll(): Promise<ReconciliationReport> {
    const startTime = Date.now();
    const pendingReport = await this.reconcilePendingTransactions();
    const fullReport =
      await this.reconcileCancelledEventFinances(pendingReport);
    fullReport.durationMs = Date.now() - startTime;
    return fullReport;
  }
}
