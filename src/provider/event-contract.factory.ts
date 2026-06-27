import { IEventContractProvider } from './event-contract.provider';
import { MockEventContractProvider } from './mock-event-contract.provider';

export class EventContractConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EventContractConfigError';
  }
}

/**
 * Resolves the event contract provider from Soroban env configuration.
 * Fails fast on partial config instead of silently using the mock provider.
 */
export function getEventContractProvider(): IEventContractProvider {
  const contractId = process.env.EVENT_CONTRACT_ID || '';
  const rpcUrl = process.env.SOROBAN_RPC_URL || '';
  const passphrase = process.env.SOROBAN_NETWORK_PASSPHRASE || '';
  const signerSecret = process.env.SOROBAN_ATTEND_SIGNER_SECRET || '';

  const values = [contractId, rpcUrl, passphrase, signerSecret];
  const setCount = values.filter(Boolean).length;

  if (setCount > 0 && setCount < values.length) {
    throw new EventContractConfigError(
      'Partial Soroban attend configuration: set EVENT_CONTRACT_ID, SOROBAN_RPC_URL, SOROBAN_NETWORK_PASSPHRASE, and SOROBAN_ATTEND_SIGNER_SECRET together',
    );
  }

  if (setCount === values.length) {
    const {
      SorobanEventContractProvider,
    } = require('./soroban-event-contract.provider');
    return SorobanEventContractProvider.getInstance();
  }

  if (process.env.NODE_ENV === 'production') {
    throw new EventContractConfigError(
      'Soroban attend configuration is required in production',
    );
  }

  return MockEventContractProvider.getInstance();
}
