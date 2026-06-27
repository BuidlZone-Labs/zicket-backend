import {
  BASE_FEE,
  Contract,
  Keypair,
  nativeToScVal,
  rpc,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import { assertValidSorobanSymbol } from '../utils/soroban-symbol';
import {
  IEventContractProvider,
  VerifyAndAttendResult,
} from './event-contract.provider';

function nullifierToBytes32(nullifier: string): Buffer {
  const hex = BigInt(nullifier).toString(16).padStart(64, '0').slice(-64);
  return Buffer.from(hex, 'hex');
}

/**
 * Submits verify_and_attend to the Soroban event contract (#121).
 *
 * Env: EVENT_CONTRACT_ID, SOROBAN_RPC_URL, SOROBAN_NETWORK_PASSPHRASE,
 *      SOROBAN_ATTEND_SIGNER_SECRET
 */
export class SorobanEventContractProvider implements IEventContractProvider {
  private static _instance: SorobanEventContractProvider | null = null;
  private readonly server: rpc.Server;
  private readonly contract: Contract;
  private readonly networkPassphrase: string;
  private readonly signer: Keypair;

  private constructor() {
    const rpcUrl = process.env.SOROBAN_RPC_URL || '';
    const contractId = process.env.EVENT_CONTRACT_ID || '';
    const networkPassphrase = process.env.SOROBAN_NETWORK_PASSPHRASE || '';
    const signerSecret = process.env.SOROBAN_ATTEND_SIGNER_SECRET || '';

    if (!rpcUrl || !contractId || !networkPassphrase || !signerSecret) {
      throw new Error(
        'EVENT_CONTRACT_ID, SOROBAN_RPC_URL, SOROBAN_NETWORK_PASSPHRASE, and SOROBAN_ATTEND_SIGNER_SECRET must be configured',
      );
    }

    this.networkPassphrase = networkPassphrase;
    this.server = new rpc.Server(rpcUrl, {
      allowHttp: rpcUrl.startsWith('http://'),
    });
    this.contract = new Contract(contractId);
    this.signer = Keypair.fromSecret(signerSecret);
  }

  /** Returns the singleton Soroban event contract provider. */
  static getInstance(): SorobanEventContractProvider {
    if (!this._instance) this._instance = new SorobanEventContractProvider();
    return this._instance;
  }

  /**
   * Invokes verify_and_attend(event_id, nullifier) on the event contract.
   */
  async verifyAndAttend(
    onChainEventId: string,
    nullifier: string,
  ): Promise<VerifyAndAttendResult> {
    assertValidSorobanSymbol(onChainEventId, 'onChainEventId');

    const sourceAccount = await this.server.getAccount(this.signer.publicKey());

    const tx = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        this.contract.call(
          'verify_and_attend',
          nativeToScVal(onChainEventId, { type: 'symbol' }),
          nativeToScVal(nullifierToBytes32(nullifier), { type: 'bytes' }),
        ),
      )
      .setTimeout(180)
      .build();

    const prepared = await this.server.prepareTransaction(tx);
    prepared.sign(this.signer);

    const sendResult = await this.server.sendTransaction(prepared);

    if (sendResult.status === 'ERROR') {
      throw new Error(
        `verify_and_attend submission failed: ${sendResult.errorResult?.toXDR('base64')}`,
      );
    }

    return { txHash: sendResult.hash };
  }
}
