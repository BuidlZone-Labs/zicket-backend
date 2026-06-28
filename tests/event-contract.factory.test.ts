import { getEventContractProvider, EventContractConfigError } from '../src/provider/event-contract.factory';

describe('getEventContractProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, NODE_ENV: 'test' };
    delete process.env.EVENT_CONTRACT_ID;
    delete process.env.SOROBAN_RPC_URL;
    delete process.env.SOROBAN_NETWORK_PASSPHRASE;
    delete process.env.SOROBAN_ATTEND_SIGNER_SECRET;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses mock provider when Soroban attend env is unset in non-production', () => {
    const provider = getEventContractProvider();
    expect(provider.constructor.name).toBe('MockEventContractProvider');
  });

  it('throws on partial Soroban attend configuration', () => {
    process.env.EVENT_CONTRACT_ID = 'C123';
    process.env.SOROBAN_RPC_URL = 'https://soroban-testnet.stellar.org';

    expect(() => getEventContractProvider()).toThrow(EventContractConfigError);
  });
});
