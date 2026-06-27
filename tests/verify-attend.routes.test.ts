import request from 'supertest';
import express from 'express';
import verifyAttendRoutes from '../src/routes/verify-attend.route';
import { VerifyAttendService } from '../src/services/verify-attend.service';
import {
  NullifierAlreadyUsedError,
  VerifyAttendFailedError,
} from '../src/errors/verifyAttendError';

jest.mock('../src/services/verify-attend.service');

const mockVerifyAttend = VerifyAttendService as jest.Mocked<
  typeof VerifyAttendService
>;

const app = express();
app.use(express.json());
app.use('/events', verifyAttendRoutes);

describe('POST /events/:id/verify-attend (#121)', () => {
  const eventId = '507f1f77bcf86cd799439011';
  const futureExpiry = Math.floor(Date.now() / 1000) + 86_400;
  const body = {
    proof: { pi_a: ['1'], pi_b: [['1']], pi_c: ['1'] },
    publicSignals: ['nullifier-xyz', 'birth', futureExpiry.toString()],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('accepts zkPassport proof payload without auth header', async () => {
    mockVerifyAttend.verifyAttend.mockResolvedValue({
      eventId,
      onChainEventId: 'EVT_1',
      nullifier: 'nullifier-xyz',
      txHash: 'tx_abc',
    });

    const res = await request(app)
      .post(`/events/${eventId}/verify-attend`)
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.txHash).toBe('tx_abc');
    expect(mockVerifyAttend.verifyAttend).toHaveBeenCalledWith(
      eventId,
      expect.objectContaining({ publicSignals: body.publicSignals }),
    );
  });

  it('returns generic failure without leaking claim details', async () => {
    mockVerifyAttend.verifyAttend.mockRejectedValue(new VerifyAttendFailedError());

    const res = await request(app)
      .post(`/events/${eventId}/verify-attend`)
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VERIFICATION_FAILED');
    expect(res.body.message).toBe('Attendance verification failed.');
    expect(res.body.message).not.toMatch(/birth date|citizenship|nationality/i);
  });

  it('returns nullifier reuse error for same event', async () => {
    mockVerifyAttend.verifyAttend.mockRejectedValue(
      new NullifierAlreadyUsedError(),
    );

    const res = await request(app)
      .post(`/events/${eventId}/verify-attend`)
      .send(body);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('NULLIFIER_ALREADY_USED');
  });

  it('returns generic failure for invalid body shape', async () => {
    const res = await request(app)
      .post(`/events/${eventId}/verify-attend`)
      .send({ proof: {} });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VERIFICATION_FAILED');
    expect(mockVerifyAttend.verifyAttend).not.toHaveBeenCalled();
  });
});
