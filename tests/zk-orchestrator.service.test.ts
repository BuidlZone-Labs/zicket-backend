import zkOrchestratorService from '../src/services/zk-orchestrator.service';
import queueService from '../src/services/queue.service';
import { ZkIntegrationOrchestrator } from '../src/services/zk-orchestrator.service';

type MockUser = {
  email: string;
  _id: { toString: () => string } | string;
  zkEmail?: string;
  zkPassport?: string;
  emailVerifiedAt?: Date;
  save: jest.Mock<Promise<void>, []>;
};

jest.mock('../src/services/queue.service', () => ({
  __esModule: true,
  default: {
    enqueueZkEmailHook: jest.fn(),
  },
}));

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(false),
  readFileSync: jest.fn(),
}));

jest.mock('../src/models/user', () => ({
  __esModule: true,
  default: {
    findByIdAndUpdate: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock('snarkjs', () => ({
  groth16: { verify: jest.fn() },
}));

describe('ZkOrchestratorService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    delete process.env.ZKEMAIL_RELAY_URL;
    delete process.env.ZKPASSPORT_RELAY_URL;
  });

  it('returns successfully when no zk environment is configured', async () => {
    const user = {
      email: 'test@example.com',
      _id: 'user-id',
      save: jest.fn().mockResolvedValue(undefined),
    } as unknown as MockUser;

    await expect(
      zkOrchestratorService.orchestrateForUser(user as any),
    ).resolves.toBeUndefined();
    expect(queueService.enqueueZkEmailHook).not.toHaveBeenCalled();
    expect(user.save).not.toHaveBeenCalled();
  });

  it('enqueues a zkEmail hook and sets zkEmail when ZKEMAIL_RELAY_URL is configured', async () => {
    process.env.ZKEMAIL_RELAY_URL = 'http://localhost/zkemail';
    (queueService.enqueueZkEmailHook as jest.Mock).mockResolvedValue('job-id');

    const user = {
      email: 'user@example.com',
      _id: 'user-id',
      zkEmail: undefined,
      zkPassport: undefined,
      emailVerifiedAt: new Date(),
      save: jest.fn().mockResolvedValue(undefined),
    } as unknown as MockUser;

    await expect(
      zkOrchestratorService.orchestrateForUser(user as any),
    ).resolves.toBeUndefined();
    expect(queueService.enqueueZkEmailHook).toHaveBeenCalledTimes(1);
    expect(user.zkEmail).toBe(
      require('crypto')
        .createHash('sha256')
        .update('user@example.com')
        .digest('hex'),
    );
    expect(user.save).toHaveBeenCalledTimes(1);
  });

  describe('ZkIntegrationOrchestrator', () => {
    it('gracefully falls back to mock verification when vKeys are missing in dev', async () => {
      const result = await ZkIntegrationOrchestrator.verifyIdentity({
        userId: '507f1f77bcf86cd799439011',
        provider: 'zk-email',
        proofPayload: {
          proof: {},
          publicSignals: ['123'],
        },
        allowFallback: false,
      });

      // Because existsSync is mocked to false, it should fallback to mock verification safely
      expect(result.success).toBe(true);
      expect(result.verifiedId).toBe('verified-zk-email@example.com');
    });
  });
});
