import crypto from 'crypto';
import { nullifierToCanonicalHex } from './nullifier-bytes';

export class AttendanceNullifierPepperError extends Error {
  constructor() {
    super('ATTENDANCE_NULLIFIER_PEPPER must be configured');
    this.name = 'AttendanceNullifierPepperError';
  }
}

/**
 * Derives an event-scoped digest for nullifier storage.
 * The raw zkPassport nullifier is never written to MongoDB.
 */
export function attendanceNullifierDigest(
  eventId: string,
  nullifier: string,
): string {
  const pepper = process.env.ATTENDANCE_NULLIFIER_PEPPER;
  if (!pepper) {
    throw new AttendanceNullifierPepperError();
  }

  return crypto
    .createHmac('sha256', pepper)
    .update(`${eventId}:${nullifierToCanonicalHex(nullifier)}`)
    .digest('hex');
}
