import Transaction from '../models/transaction';
import { BlockchainProvider } from '../provider/blockchain.provider';
import { PaymentVerificationError, ServiceUnavailableError } from '../errors/AppError';

export interface VerifyRequest {
  txHash: string;
  expectedAmountUsd: number;
  expectedRecipient?: string;
  orderRef: string;
  chainId?: string;
}

export interface VerifyResult {
  txHash: string;
  confirmedAmountWei: bigint;
  from: string;
  to: string;
  confirmations: number;
}

const RETRY_DELAYS_MS = [0, 30_000, 120_000, 600_000, 1_800_000];
const RPC_TIMEOUT_MS = 10_000;

async function withRpcRetry<T>(
  fn: () => Promise<T>,
  label: string,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    }
    try {
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('RPC timeout')), RPC_TIMEOUT_MS),
        ),
      ]);
      return result;
    } catch (err) {
      lastErr = err;
      console.warn(
        `[PaymentVerificationService] ${label} attempt ${attempt + 1} failed:`,
        err,
      );
    }
  }
  throw new ServiceUnavailableError(
    `Payment verification service is temporarily unavailable after ${RETRY_DELAYS_MS.length} attempts. Please try again shortly.`,
  );
}

export class PaymentVerificationService {
  /**
   * Verify an on-chain payment against expected criteria.
   *
   * Throws PaymentVerificationError for permanent business-logic failures
   * (wrong recipient, insufficient amount, replay, not finalized).
   *
   * Throws ServiceUnavailableError for transient RPC failures.
   *
   * Returns VerifyResult on success — caller is responsible for issuance.
   */
  static async verify(req: VerifyRequest): Promise<VerifyResult> {
    const { txHash, expectedAmountUsd, orderRef } = req;
    const expectedRecipient = req.expectedRecipient;

    // ── 1. Replay guard ───────────────────────────────────────────────────────
    const existing = await Transaction.findOne({ transactionId: txHash }).lean();
    if (existing) {
      throw new PaymentVerificationError(
        `Transaction ${txHash} has already been used to fulfill order ${existing.eventTicket}.`,
      );
    }

    // ── 2. Fetch from chain (with retry + timeout) ────────────────────────────
    const blockchain = BlockchainProvider.getInstance();
    const chainTx = await withRpcRetry(
      () => blockchain.fetchTransaction(txHash),
      `fetchTransaction(${txHash})`,
    );

    if (!chainTx) {
      throw new PaymentVerificationError(
        `Transaction ${txHash} was not found on chain.`,
      );
    }

    // ── 3. Finality check ─────────────────────────────────────────────────────
    if (chainTx.status === 'failed') {
      throw new PaymentVerificationError(
        `Transaction ${txHash} failed on chain and cannot be used for payment.`,
      );
    }

    if (chainTx.status === 'pending') {
      throw new PaymentVerificationError(
        `Transaction ${txHash} is still pending. Please wait for confirmation and try again.`,
      );
    }

    const minConfirmations = blockchain.getMinConfirmations();
    if (chainTx.confirmations < minConfirmations) {
      throw new PaymentVerificationError(
        `Transaction ${txHash} has ${chainTx.confirmations} confirmation(s); ${minConfirmations} required. Please try again shortly.`,
      );
    }

    // ── 4. Recipient check ────────────────────────────────────────────────────
    const platformWallet = expectedRecipient ?? blockchain.getPlatformWallet();
    if (chainTx.to.toLowerCase() !== platformWallet.toLowerCase()) {
      throw new PaymentVerificationError(
        `Transaction ${txHash} was sent to ${chainTx.to}, not the expected address ${platformWallet}.`,
      );
    }

    // ── 5. Value check ────────────────────────────────────────────────────────
    // Convert ETH-denominated expected amount to wei for comparison.
    // 1 ETH = 1e18 wei; expectedAmountUsd is treated as ETH here.
    // In production swap in a price oracle for USD→ETH conversion.
    const expectedWei = BigInt(Math.round(expectedAmountUsd * 1e18));
    if (chainTx.valueWei < expectedWei) {
      throw new PaymentVerificationError(
        `Transaction ${txHash} transferred ${chainTx.valueWei} wei but ${expectedWei} wei was expected for order ${orderRef}.`,
      );
    }

    console.info(
      `[PaymentVerificationService] Verified tx=${txHash} for order=${orderRef}: ${chainTx.confirmations} confirmations, value=${chainTx.valueWei} wei.`,
    );

    return {
      txHash,
      confirmedAmountWei: chainTx.valueWei,
      from: chainTx.from,
      to: chainTx.to,
      confirmations: chainTx.confirmations,
    };
  }
}