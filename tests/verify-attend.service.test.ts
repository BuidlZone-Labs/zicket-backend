import mongoose from 'mongoose';
import { VerifyAttendService } from '../src/services/verify-attend.service';
import EventTicket from '../src/models/event-ticket';
import AttendanceNullifier from '../src/models/attendance-nullifier';
import { ZkPassportAttendVerifier } from '../src/services/zkpassport-attend-verifier.service';
import { getEventContractProvider } from '../src/provider/event-contract.factory';
import {
  NullifierAlreadyUsedError,
  VerifyAttendFailedError,
} from '../src/errors/verifyAttendError';
import { attendanceNullifierDigest } from '../src/utils/attendance-nullifier-digest';

jest.mock('../src/models/event-ticket');
jest.mock('../src/models/attendance-nullifier');
jest.mock('../src/services/zkpassport-attend-verifier.service');
jest.mock('../src/provider/event-contract.factory');

const mockEventTicket = EventTicket as jest.Mocked<typeof EventTicket>;
const mockAttendanceNullifier = AttendanceNullifier as jest.Mocked<
  typeof AttendanceNullifier
>;
const mockVerifier = ZkPassportAttendVerifier as jest.Mocked<
  typeof ZkPassportAttendVerifier
>;
const mockGetContract = getEventContractProvider as jest.MockedFunction<
  typeof getEventContractProvider
>;

describe('VerifyAttendService (#121)', () => {
  const eventId = new mongoose.Types.ObjectId().toString();
  const futureExpiry = Math.floor(Date.now() / 1000) + 86_400;
  const proofPayload = {
    proof: { pi_a: ['1'], pi_b: [['1']], pi_c: ['1'] },
    publicSignals: ['nullifier-abc', 'birth', futureExpiry.toString()],
  };

  const mockContract = {
    verifyAndAttend: jest.fn().mockResolvedValue({ txHash: 'tx_hash_1' }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetContract.mockReturnValue(mockContract as any);
  });

  it('verifies proof, submits verify_and_attend, and records nullifier', async () => {
    mockEventTicket.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          privacyLevel: 2,
          onChainEventId: 'EVT_VERIFY',
          eventStatus: 'upcoming',
        }),
      }),
    } as any);

    mockAttendanceNullifier.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    } as any);

    mockVerifier.verify.mockResolvedValue({ nullifier: 'nullifier-abc' });
    mockAttendanceNullifier.create.mockResolvedValue({} as any);

    const result = await VerifyAttendService.verifyAttend(eventId, proofPayload);

    expect(mockVerifier.verify).toHaveBeenCalledWith(proofPayload);
    expect(mockContract.verifyAndAttend).toHaveBeenCalledWith(
      'EVT_VERIFY',
      'nullifier-abc',
    );
    expect(mockAttendanceNullifier.create).toHaveBeenCalledWith(
      expect.objectContaining({
        nullifier: attendanceNullifierDigest(eventId, 'nullifier-abc'),
        onChainTxHash: 'tx_hash_1',
      }),
    );
    expect(result.txHash).toBe('tx_hash_1');
  });

  it('test_verify_attend_rejects_reused_nullifier_same_event', async () => {
    mockEventTicket.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          privacyLevel: 2,
          onChainEventId: 'EVT_VERIFY',
          eventStatus: 'ongoing',
        }),
      }),
    } as any);

    mockAttendanceNullifier.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ nullifier: 'nullifier-abc' }),
    } as any);

    await expect(
      VerifyAttendService.verifyAttend(eventId, proofPayload),
    ).rejects.toBeInstanceOf(NullifierAlreadyUsedError);

    expect(mockVerifier.verify).not.toHaveBeenCalled();
    expect(mockContract.verifyAndAttend).not.toHaveBeenCalled();
  });

  it('allows the same nullifier on a different event', async () => {
    const otherEventId = new mongoose.Types.ObjectId().toString();

    mockEventTicket.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          privacyLevel: 2,
          onChainEventId: 'EVT_OTHER',
          eventStatus: 'upcoming',
        }),
      }),
    } as any);

    mockAttendanceNullifier.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    } as any);

    mockVerifier.verify.mockResolvedValue({ nullifier: 'nullifier-abc' });
    mockAttendanceNullifier.create.mockResolvedValue({} as any);

    await expect(
      VerifyAttendService.verifyAttend(otherEventId, proofPayload),
    ).resolves.toMatchObject({ onChainEventId: 'EVT_OTHER' });
  });

  it('returns generic failure when proof verification fails', async () => {
    mockEventTicket.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          privacyLevel: 2,
          onChainEventId: 'EVT_VERIFY',
          eventStatus: 'upcoming',
        }),
      }),
    } as any);

    mockAttendanceNullifier.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    } as any);

    mockVerifier.verify.mockResolvedValue(null);

    await expect(
      VerifyAttendService.verifyAttend(eventId, proofPayload),
    ).rejects.toBeInstanceOf(VerifyAttendFailedError);
  });

  it('rejects expired proofs before relay', async () => {
    const expiredPayload = {
      proof: proofPayload.proof,
      publicSignals: [
        'nullifier-abc',
        'birth',
        (Math.floor(Date.now() / 1000) - 60).toString(),
      ],
    };

    mockEventTicket.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          privacyLevel: 2,
          onChainEventId: 'EVT_VERIFY',
          eventStatus: 'upcoming',
        }),
      }),
    } as any);

    await expect(
      VerifyAttendService.verifyAttend(eventId, expiredPayload),
    ).rejects.toBeInstanceOf(VerifyAttendFailedError);

    expect(mockVerifier.verify).not.toHaveBeenCalled();
  });

  it('rejects non verified-access events with generic failure', async () => {
    mockEventTicket.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          privacyLevel: 1,
          onChainEventId: 'EVT_VERIFY',
          eventStatus: 'upcoming',
        }),
      }),
    } as any);

    await expect(
      VerifyAttendService.verifyAttend(eventId, proofPayload),
    ).rejects.toBeInstanceOf(VerifyAttendFailedError);
  });
});
