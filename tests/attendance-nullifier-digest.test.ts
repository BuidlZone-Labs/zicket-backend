import { attendanceNullifierDigest } from '../src/utils/attendance-nullifier-digest';

describe('attendanceNullifierDigest', () => {
  const originalPepper = process.env.ATTENDANCE_NULLIFIER_PEPPER;

  beforeEach(() => {
    process.env.ATTENDANCE_NULLIFIER_PEPPER = 'test-pepper-value';
  });

  afterAll(() => {
    process.env.ATTENDANCE_NULLIFIER_PEPPER = originalPepper;
  });
  it('produces different digests for different events with the same nullifier', () => {
    const digestA = attendanceNullifierDigest('event-a', 'nullifier-1');
    const digestB = attendanceNullifierDigest('event-b', 'nullifier-1');

    expect(digestA).not.toBe(digestB);
    expect(digestA).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is deterministic for the same event and nullifier', () => {
    expect(
      attendanceNullifierDigest('event-a', 'nullifier-1'),
    ).toBe(attendanceNullifierDigest('event-a', 'nullifier-1'));
  });
});
