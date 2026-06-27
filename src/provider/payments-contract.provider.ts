import { EventFinancialState } from '../types/payments-contract.types';

export interface IPaymentsContractProvider {
  getEventFinancialState(onChainEventId: string): Promise<EventFinancialState>;
  getPlatformFeeBps(): Promise<number>;
}

let providerOverride: IPaymentsContractProvider | null = null;

/** Test hook — inject a mock provider. */
export function setPaymentsContractProvider(
  provider: IPaymentsContractProvider | null,
): void {
  providerOverride = provider;
}

export function isPaymentsContractConfigured(): boolean {
  return Boolean(
    process.env.SOROBAN_RPC_URL &&
    process.env.PAYMENTS_CONTRACT_ID &&
    process.env.SOROBAN_NETWORK_PASSPHRASE,
  );
}

export function getPaymentsContractProvider(): IPaymentsContractProvider {
  if (providerOverride) return providerOverride;

  if (!isPaymentsContractConfigured()) {
    throw new Error(
      'SOROBAN_RPC_URL, PAYMENTS_CONTRACT_ID, and SOROBAN_NETWORK_PASSPHRASE must be configured for contract reads',
    );
  }

  // Lazy load to avoid pulling @stellar/stellar-sdk into unit tests.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {
    SorobanPaymentsContractProvider,
  } = require('./soroban-payments-contract.provider');
  return SorobanPaymentsContractProvider.getInstance();
}
