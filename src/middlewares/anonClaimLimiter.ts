import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Anonymous claim rate limiter — coordinated with the on-chain
 * claim_anonymous_ticket window limiter (Issue #124).
 *
 * Contract constants (from zicket-contract):
 *   anon_window_size           = 100 ledgers (~8.3 minutes at 5s/ledger)
 *   max_anon_claims_per_window = 5 claims per window
 *
 * Backend policy: the API window MUST be >= the contract window so that
 * a request the contract would accept is never blocked here first.
 *
 *   API window  : 10 minutes  (> 8.3 min contract window)
 *   API quota   : 5 requests  (== contract quota — never stricter)
 */

// ── Contract window constants (kept in sync with zicket-contract) ──────────
export const CONTRACT_ANON_WINDOW_LEDGERS = 100;
export const CONTRACT_ANON_MAX_CLAIMS = 5;
export const LEDGER_DURATION_MS = 5_000; // 5 seconds per Stellar ledger

export const CONTRACT_WINDOW_MS =
  CONTRACT_ANON_WINDOW_LEDGERS * LEDGER_DURATION_MS; // ~8.3 min

export const ANON_CLAIM_WINDOW_MS = CONTRACT_WINDOW_MS; // exactly matches contract window
export const ANON_CLAIM_MAX_REQUESTS = CONTRACT_ANON_MAX_CLAIMS; // 5

/**
 * Normalise a raw req.ip value so that IPv6-mapped IPv4 addresses
 * (e.g. "::ffff:1.2.3.4") are stored as plain IPv4 ("1.2.3.4").
 * This prevents one client from spreading requests across multiple
 * rate-limit buckets via IPv6 privacy addresses.
 */
function normalizeIp(raw: string | undefined): string {
  if (!raw) return 'unknown';
  // Strip IPv6-mapped IPv4 prefix
  if (raw.startsWith('::ffff:')) return raw.slice(7);
  return raw;
}

export const anonClaimLimiter = rateLimit({
  windowMs: ANON_CLAIM_WINDOW_MS,
  max: ANON_CLAIM_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const ip = normalizeIp(req.ip || req.connection?.remoteAddress);
    const deviceId =
      req.headers['x-device-id'] ||
      req.headers['x-session-id'] ||
      req.get('User-Agent') ||
      'unknown';
    return `anon_claim:${ip}:${deviceId}`;
  },
  handler: (req: Request, res: Response) => {
    // Use the actual reset time when available so clients blocked late in
    // a window get an accurate remaining cooldown rather than the full window.
    const rl = (req as any).rateLimit as { resetTime?: Date } | undefined;
    const retryAfterMs =
      rl?.resetTime
        ? Math.max(0, rl.resetTime.getTime() - Date.now())
        : ANON_CLAIM_WINDOW_MS;

    res.status(429).json({
      error: 'TOO_MANY_REQUESTS',
      code: 'ANON_CLAIM_RATE_LIMITED',
      message:
        'You are sending anonymous claim requests too fast. ' +
        'Please wait before retrying.',
      retryAfterMs,
    });
  },
  skipSuccessfulRequests: false,
  skip: (req: Request) =>
    process.env.NODE_ENV === 'test' ||
    (process.env.NODE_ENV === 'development' &&
      (req.ip === '127.0.0.1' || req.ip === '::1')),
});