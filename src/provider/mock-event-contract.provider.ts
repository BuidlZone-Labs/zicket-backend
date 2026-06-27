import crypto from 'crypto';
import { VerifyAndAttendResult, IEventContractProvider } from './event-contract.provider';

/**
 * Dev/test fallback when EVENT_CONTRACT_ID is not configured.
 */
export class MockEventContractProvider implements IEventContractProvider {
  private static _instance: MockEventContractProvider | null = null;

  static getInstance(): MockEventContractProvider {
    if (!this._instance) this._instance = new MockEventContractProvider();
    return this._instance;
  }

  /**
   * Simulates verify_and_attend without submitting an on-chain transaction.
   */
  async verifyAndAttend(
    onChainEventId: string,
    nullifier: string,
  ): Promise<VerifyAndAttendResult> {
    const txHash = crypto
      .createHash('sha256')
      .update(`${onChainEventId}:${nullifier}`)
      .digest('hex');

    return { txHash: `mock_${txHash.slice(0, 32)}` };
  }
}
