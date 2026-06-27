import { AppError } from './AppError';

/** Generic verification failure — never exposes which claim (age/location) failed. */
export class VerifyAttendFailedError extends AppError {
  constructor() {
    super('Attendance verification failed.', 400, 'VERIFICATION_FAILED');
  }
}

/** Nullifier already consumed for this event (not a proof-claim leak). */
export class NullifierAlreadyUsedError extends AppError {
  constructor() {
    super(
      'This attendance proof has already been used for this event.',
      409,
      'NULLIFIER_ALREADY_USED',
    );
  }
}
