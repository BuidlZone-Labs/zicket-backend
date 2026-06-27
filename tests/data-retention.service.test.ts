import { DataRetentionService } from '../src/services/data-retention.service';
import AnonymizationJob from '../src/models/anonymization-job';
import TempData from '../src/models/temp-data';
import Log from '../src/models/log';
import { AnonymizationService } from '../src/services/anonymization.service';

jest.mock('../src/models/anonymization-job');
jest.mock('../src/models/temp-data');
jest.mock('../src/models/log');
jest.mock('../src/services/anonymization.service');

const mockAnonymizationJob = AnonymizationJob as jest.Mocked<
  typeof AnonymizationJob
>;
const mockTempData = TempData as jest.Mocked<typeof TempData>;
const mockLog = Log as jest.Mocked<typeof Log>;

describe('DataRetentionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports collection counts and retries stale jobs', async () => {
    mockTempData.estimatedDocumentCount.mockResolvedValue(3);
    mockLog.estimatedDocumentCount.mockResolvedValue(12);

    const staleJob = { _id: 'job1', targetUserId: 'user1', status: 'pending' };
    const failedJob = { _id: 'job2', targetUserId: 'user2', status: 'failed' };

    const saveMock = jest.fn().mockResolvedValue(undefined);
    const hydratedJob = (raw: { _id: string; targetUserId: string }) => ({
      ...raw,
      status: 'pending',
      save: saveMock,
    });

    (mockAnonymizationJob.find as jest.Mock).mockImplementation(
      (query: { status?: string }) => {
        const jobs =
          query.status === 'pending'
            ? [staleJob]
            : query.status === 'failed'
              ? [failedJob]
              : [];
        return Promise.resolve(jobs.map((j) => hydratedJob(j)));
      },
    );

    (AnonymizationService.executeJob as jest.Mock).mockResolvedValue({
      status: 'completed',
    });

    const report = await DataRetentionService.runRetentionPass();

    expect(report.tempDataCount).toBe(3);
    expect(report.logCount).toBe(12);
    expect(report.pendingAnonymizationJobs).toBe(1);
    expect(report.anonymizationJobsProcessed).toBe(2);
    expect(AnonymizationService.executeJob).toHaveBeenCalledTimes(2);
  });
});
