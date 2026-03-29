import { ethers } from 'ethers';

/**
 * Shared by #75, #81, #78 — single source of truth for on-chain reads.
 * Set BLOCKCHAIN_RPC_URL, PLATFORM_WALLET_ADDRESS, MIN_CONFIRMATIONS in .env
 */

const RPC_URL = process.env.BLOCKCHAIN_RPC_URL || '';
const PLATFORM_WALLET = (
  process.env.PLATFORM_WALLET_ADDRESS || ''
).toLowerCase();
const MIN_CONFIRMATIONS = parseInt(process.env.MIN_CONFIRMATIONS || '2', 10);

export interface ChainTransaction {
  hash: string;
  from: string;
  to: string;
  valueWei: bigint;
  blockNumber: number | null;
  confirmations: number;
  status: 'pending' | 'confirmed' | 'failed';
}

export class BlockchainProvider {
  private provider: ethers.JsonRpcProvider;
  private static _instance: BlockchainProvider | null = null;

  private constructor() {
    if (!RPC_URL)
      throw new Error('BLOCKCHAIN_RPC_URL is not configured in .env');
    this.provider = new ethers.JsonRpcProvider(RPC_URL);
  }

  static getInstance(): BlockchainProvider {
    if (!this._instance) this._instance = new BlockchainProvider();
    return this._instance;
  }

  async fetchTransaction(txHash: string): Promise<ChainTransaction | null> {
    try {
      const [tx, receipt, currentBlock] = await Promise.all([
        this.provider.getTransaction(txHash),
        this.provider.getTransactionReceipt(txHash),
        this.provider.getBlockNumber(),
      ]);

      if (!tx) return null;

      let status: ChainTransaction['status'] = 'pending';
      let confirmations = 0;

      if (receipt) {
        confirmations = receipt.blockNumber
          ? currentBlock - receipt.blockNumber
          : 0;
        status = receipt.status === 1 ? 'confirmed' : 'failed';
      }

      return {
        hash: tx.hash,
        from: tx.from.toLowerCase(),
        to: (tx.to || '').toLowerCase(),
        valueWei: tx.value,
        blockNumber: receipt?.blockNumber ?? null,
        confirmations,
        status,
      };
    } catch (err) {
      console.error(`[BlockchainProvider] Error fetching tx ${txHash}:`, err);
      return null;
    }
  }

  getPlatformWallet(): string {
    return PLATFORM_WALLET;
  }

  getMinConfirmations(): number {
    return MIN_CONFIRMATIONS;
  }
}
