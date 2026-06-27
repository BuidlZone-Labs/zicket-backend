import { IEventContractProvider } from './event-contract.provider';
import { MockEventContractProvider } from './mock-event-contract.provider';

export function getEventContractProvider(): IEventContractProvider {
  const contractId = process.env.EVENT_CONTRACT_ID || '';
  const rpcUrl = process.env.SOROBAN_RPC_URL || '';
  const passphrase = process.env.SOROBAN_NETWORK_PASSPHRASE || '';
  const signerSecret = process.env.SOROBAN_ATTEND_SIGNER_SECRET || '';

  if (contractId && rpcUrl && passphrase && signerSecret) {
    // Lazy require avoids loading @stellar/stellar-sdk in unit tests.
    const {
      SorobanEventContractProvider,
    } = require('./soroban-event-contract.provider');
    return SorobanEventContractProvider.getInstance();
  }

  return MockEventContractProvider.getInstance();
}
