import mongoose from 'mongoose';
import { AnonymizationService } from '../src/services/anonymization.service';
import User from '../src/models/user';
import AnonymizationJob from '../src/models/anonymization-job';
import { ErasureAssessmentService } from '../src/services/erasure-assessment.service';

jest.mock('../src/models/user');
jest.mock('../src/models/anonymization-job');
jest.mock('../src/services/erasure-assessment.service');

const mockUser = User as jest.Mocked<typeof User>;
const mockAnonymizationJob = AnonymizationJob as jest.Mocked<
  typeof AnonymizationJob
>;
const mockErasureAssessment = ErasureAssessmentService as jest.Mocked<
  typeof ErasureAssessmentService
>;

describe('AnonymizationService', () => {
  const userId = new mongoose.Types.ObjectId();
  const jobId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('anonymizes user profile and completes job', async () => {
    const saveUser = jest.fn().mockResolvedValue(undefined);
    const userDoc = {
      _id: userId,
      name: 'Alice',
      email: 'alice@example.com',
      password: 'hash',
      anonymizedAt: undefined,
      save: saveUser,
    };

    (mockUser.findById as jest.Mock).mockResolvedValue(userDoc);
    (mockAnonymizationJob.findOne as jest.Mock).mockResolvedValue(null);
    (mockAnonymizationJob.create as jest.Mock).mockResolvedValue({
      _id: jobId,
      targetUserId: userId,
      status: 'pending',
      save: jest.fn().mockResolvedValue(undefined),
    });

    mockErasureAssessment.assessUser.mockResolvedValue({
      userId: userId.toString(),
      offChainErasable: true,
      onChainPermanentData: false,
      onChainPermanentReasons: [],
      ordersReviewed: 0,
      standardPaymentOrders: 0,
      anonymousOnlyPaymentHistory: false,
    });

    const result = await AnonymizationService.requestErasure(userId.toString());

    expect(result.status).toBe('completed');
    expect(saveUser).toHaveBeenCalled();
    expect(userDoc.name).toBe('Deleted User');
    expect(userDoc.email).toMatch(/deleted\+.*@anonymized\.zicket\.local/);
    expect(userDoc.password).toBeUndefined();
    expect(userDoc.anonymizedAt).toBeInstanceOf(Date);
  });

  it('rejects duplicate erasure for already anonymized accounts', async () => {
    (mockUser.findById as jest.Mock).mockResolvedValue({
      _id: userId,
      anonymizedAt: new Date(),
    });

    await expect(
      AnonymizationService.requestErasure(userId.toString()),
    ).rejects.toThrow('Account has already been anonymized');
  });

  it('rejects when a pending job already exists', async () => {
    (mockUser.findById as jest.Mock).mockResolvedValue({
      _id: userId,
      anonymizedAt: undefined,
    });
    (mockAnonymizationJob.findOne as jest.Mock).mockResolvedValue({
      _id: jobId,
      status: 'pending',
    });

    await expect(
      AnonymizationService.requestErasure(userId.toString()),
    ).rejects.toThrow('An erasure request is already in progress');
  });
});
