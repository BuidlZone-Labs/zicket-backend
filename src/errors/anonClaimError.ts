import { AppError } from './AppError';

/**
 * Thrown when the on-chain claim_anonymous_ticket call returns
 * AnonClaimWindowFull (contract error code 10).
 *
 * This is a DISTINCT error from ANON_CLAIM_RATE_LIMITED (the backend
 * rate-limit middleware). The frontend uses the `code` field to decide
 * which message to show:
 *
 *   ANON_CLAIM_RATE_LIMITED  → "You're sending requests too fast"
 *   ANON_CLAIM_WINDOW_FULL   → "Event claim limit reached — try next window"
 */
export class AnonClaimWindowFullError extends AppError {
  /** Ledger number at which the current contract window opened. */
  readonly windowStartLedger: number;
  /** Ledger number at which the current window closes. */
  readonly windowEndLedger: number;

  constructor(windowStartLedger: number, windowEndLedger: number) {
    super(
      'The anonymous claim limit for this event window has been reached. ' +
        'Please try again in the next ledger window.',
      429,
      'ANON_CLAIM_WINDOW_FULL',
    );
    this.windowStartLedger = windowStartLedger;
    this.windowEndLedger = windowEndLedger;
  }
}