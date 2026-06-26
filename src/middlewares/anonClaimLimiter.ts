import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Anonymous claim rate limiter — coordinated with the on-chain
 * claim_anonymous_ticket window limiter (Issue #124).
 *
 * Contract constants (from zicket-contract):
 *   anon_window_size        = 100 ledgers  (~8.3 minutes at 5s/ledger)
 *   max_anon_claims_per_window = 5 claims per window
 *
 * Backend policy: the API window MUST be >= the contract window so that
 * a request the contract would accept is never blocked here first.
 *
 *   API window  : 10 minutes  (> 8.3 min contract window)
 *   API quota   : 5 requests  (== contract quota — never stricter)
 *
 * This ensures the backend never silently masks a contract-level success:
 * if the API allows the request through and the contract rejects it with
 * AnonClaimWindowFull, the error surfaces correctly to the caller.
 */

// ── Contract window constants (kept in sync with zicket-contract) ──────────
export const CONTRACT_ANON_WINDOW_LEDGERS = 100;
export const CONTRACT_ANON_MAX_CLAIMS = 5;
export const LEDGER_DURATION_MS = 5_000; // 5 seconds per Stellar ledger

/**
 * Convert the contract's ledger-based window to milliseconds so the
 * backend window can be set >= the contract window.
 */
export const CONTRACT_WINDOW_MS =
  CONTRACT_ANON_WINDOW_LEDGERS * LEDGER_DURATION_MS; // 500_000 ms = ~8.3 min

// Backend window is rounded up to the next clean interval >= contract window.
export const ANON_CLAIM_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
export const ANON_CLAIM_MAX_REQUESTS = CONTRACT_ANON_MAX_CLAIMS; // 5

/**
 * Middleware that enforces the backend-side anonymous claim rate limit.
 * Uses IP + optional device fingerprint as the key (same strategy as the
 * existing anonymousActionLimiter) so the limit is per-device, not global.
 *
 * Response shape on limit exceeded:
 * {
 *   error: "TOO_MANY_REQUESTS",
 *   code:  "ANON_CLAIM_RATE_LIMITED",
 *   message: "...",
 *   retryAfterMs: 600000
 * }
 *
 * This error code is DISTINCT from AnonClaimWindowFull (see errorHandler)
 * so the frontend can differentiate:
 *   ANON_CLAIM_RATE_LIMITED   → "You're sending requests too fast"
 *   ANON_CLAIM_WINDOW_FULL    → "Event claim limit reached for this window"
 */
export const anonClaimLimiter = rateLimit({
  windowMs: ANON_CLAIM_WINDOW_MS,
  max: ANON_CLAIM_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const deviceId =
      req.headers['x-device-id'] ||
      req.headers['x-session-id'] ||
      req.get('User-Agent') ||
      'unknown';
    return `anon_claim:${ip}:${deviceId}`;
  },
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: 'TOO_MANY_REQUESTS',
      code: 'ANON_CLAIM_RATE_LIMITED',
      message:
        'You are sending anonymous claim requests too fast. ' +
        `Please wait before retrying.`,
      retryAfterMs: ANON_CLAIM_WINDOW_MS,
    });
  },
  // Count ALL requests — do not skip successful ones.
  // A successful API call may still be rejected by the contract.
  skipSuccessfulRequests: false,
  skip: (req: Request) =>
    process.env.NODE_ENV === 'test' ||
    (process.env.NODE_ENV === 'development' &&
      (req.ip === '127.0.0.1' || req.ip === '::1')),
});