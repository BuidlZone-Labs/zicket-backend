import crypto from 'crypto';

/**
 * Derives an event-scoped digest for nullifier storage.
 * The raw zkPassport nullifier is never written to MongoDB.
 */
export function attendanceNullifierDigest(
  eventId: string,
  nullifier: string,
): string {
  const pepper =
    process.env.ATTENDANCE_NULLIFIER_PEPPER ||
    process.env.JWT_SECRET ||
    'zicket-dev-nullifier-pepper';

  return crypto
    .createHmac('sha256', pepper)
    .update(`${eventId}:${nullifier}`)
    .digest('hex');
}
