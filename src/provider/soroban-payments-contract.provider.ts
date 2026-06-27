import {
  BASE_FEE,
  Contract,
  nativeToScVal,
  rpc,
  scValToNative,
  TransactionBuilder,
  Account,
  xdr,
} from '@stellar/stellar-sdk';
import { EventFinancialState } from '../types/payments-contract.types';
import { IPaymentsContractProvider } from './payments-contract.provider';

interface EventConfigOnChain {
  cancel_ledger?: number | null;
  withdrawable_ratio_bps?: number | null;
  organizer_withdrawn?: boolean;
}

/**
 * Reads payments contract state via Soroban RPC simulation.
 * Env: SOROBAN_RPC_URL, PAYMENTS_CONTRACT_ID, SOROBAN_NETWORK_PASSPHRASE
 */
export class SorobanPaymentsContractProvider implements IPaymentsContractProvider {
  private static _instance: SorobanPaymentsContractProvider | null = null;
  private readonly server: rpc.Server;
  private readonly contract: Contract;
  private readonly networkPassphrase: string;
  private cachedPlatformFeeBps: number | null = null;

  private constructor() {
    const rpcUrl = process.env.SOROBAN_RPC_URL || '';
    const contractId = process.env.PAYMENTS_CONTRACT_ID || '';
    const networkPassphrase = process.env.SOROBAN_NETWORK_PASSPHRASE || '';
    if (!rpcUrl || !contractId || !networkPassphrase) {
      throw new Error(
        'SOROBAN_RPC_URL, PAYMENTS_CONTRACT_ID, and SOROBAN_NETWORK_PASSPHRASE must be configured for contract reads',
      );
    }

    this.networkPassphrase = networkPassphrase;
    this.server = new rpc.Server(rpcUrl, {
      allowHttp: rpcUrl.startsWith('http://'),
    });
    this.contract = new Contract(contractId);
  }

  static getInstance(): SorobanPaymentsContractProvider {
    if (!this._instance) this._instance = new SorobanPaymentsContractProvider();
    return this._instance;
  }

  async getPlatformFeeBps(): Promise<number> {
    if (this.cachedPlatformFeeBps !== null) {
      return this.cachedPlatformFeeBps;
    }

    const result = await this.simulateRead('get_platform_fee_bps');
    this.cachedPlatformFeeBps = Number(scValToNative(result));
    return this.cachedPlatformFeeBps;
  }

  async getEventFinancialState(
    onChainEventId: string,
  ): Promise<EventFinancialState> {
    const platformFeeBps = await this.getPlatformFeeBps();
    const [configVal, revenueVal] = await Promise.all([
      this.simulateRead('get_event_config', onChainEventId),
      this.simulateRead('get_event_revenue', onChainEventId),
    ]);

    const config = scValToNative(configVal) as EventConfigOnChain;

    return {
      onChainEventId,
      withdrawableRatioBps:
        config.withdrawable_ratio_bps != null
          ? config.withdrawable_ratio_bps
          : null,
      cancelLedger: config.cancel_ledger ?? null,
      organizerWithdrawn: Boolean(config.organizer_withdrawn),
      totalRevenue: BigInt(
        scValToNative(revenueVal) as string | number | bigint,
      ),
      platformFeeBps,
    };
  }

  private async simulateRead(
    method: string,
    eventId?: string,
  ): Promise<xdr.ScVal> {
    const simulationAccount = new Account(
      'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      '0',
    );

    const args = eventId ? [nativeToScVal(eventId, { type: 'symbol' })] : [];

    const tx = new TransactionBuilder(simulationAccount, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(this.contract.call(method, ...args))
      .setTimeout(180)
      .build();

    const simulation = await this.server.simulateTransaction(tx);

    if (rpc.Api.isSimulationError(simulation)) {
      throw new Error(
        `Soroban simulation failed for ${method}: ${simulation.error}`,
      );
    }

    if (!simulation.result?.retval) {
      throw new Error(`Soroban simulation returned no value for ${method}`);
    }

    return simulation.result.retval;
  }
}
