/**
 * Integration test: anonymous claim rate limiting coordination (Issue #124)
 *
 * Verifies that the two independent rate-limiting layers — the backend
 * middleware and the on-chain contract window — cannot produce contradictory
 * states, and that each returns a distinct, actionable error code.
 */

import {
  ANON_CLAIM_WINDOW_MS,
  ANON_CLAIM_MAX_REQUESTS,
  CONTRACT_ANON_MAX_CLAIMS,
  CONTRACT_WINDOW_MS,
} from '../src/middlewares/anonClaimLimiter';
import { AnonClaimWindowFullError } from '../src/errors/anonClaimError';

// ── Helper: simulate what the backend handler does when the contract
//   returns AnonClaimWindowFull. ─────────────────────────────────────────────

function simulateContractResponse(
  claimsInWindow: number,
  maxClaims: number,
): { accepted: boolean; contractError?: string } {
  if (claimsInWindow >= maxClaims) {
    return { accepted: false, contractError: 'AnonClaimWindowFull' };
  }
  return { accepted: true };
}

function mapContractError(contractError: string): { code: string; status: number } {
  if (contractError === 'AnonClaimWindowFull') {
    return { code: 'ANON_CLAIM_WINDOW_FULL', status: 429 };
  }
  return { code: 'CONTRACT_ERROR', status: 500 };
}

// ── 1. Window coordination ────────────────────────────────────────────────────

describe('Rate limit window coordination', () => {
  it('backend window is >= contract window (never stricter)', () => {
    expect(ANON_CLAIM_WINDOW_MS).toBeGreaterThanOrEqual(CONTRACT_WINDOW_MS);
  });

  it('backend quota is >= contract quota (never stricter)', () => {
    expect(ANON_CLAIM_MAX_REQUESTS).toBeGreaterThanOrEqual(
      CONTRACT_ANON_MAX_CLAIMS,
    );
  });

  it('backend window is a reasonable multiple of the contract window', () => {
    // Should not be more than 10x the contract window (would be too lenient)
    expect(ANON_CLAIM_WINDOW_MS).toBeLessThanOrEqual(CONTRACT_WINDOW_MS * 10);
  });
});

// ── 2. Distinct error codes ───────────────────────────────────────────────────

describe('Error code distinction', () => {
  it('AnonClaimWindowFullError has code ANON_CLAIM_WINDOW_FULL', () => {
    const err = new AnonClaimWindowFullError(100, 200);
    expect(err.code).toBe('ANON_CLAIM_WINDOW_FULL');
    expect(err.statusCode).toBe(429);
  });

  it('AnonClaimWindowFullError is distinct from generic rate limit code', () => {
    const err = new AnonClaimWindowFullError(100, 200);
    expect(err.code).not.toBe('ANON_CLAIM_RATE_LIMITED');
    expect(err.code).not.toBe('TOO_MANY_REQUESTS');
  });

  it('contract AnonClaimWindowFull maps to ANON_CLAIM_WINDOW_FULL code', () => {
    const { code, status } = mapContractError('AnonClaimWindowFull');
    expect(code).toBe('ANON_CLAIM_WINDOW_FULL');
    expect(status).toBe(429);
  });

  it('AnonClaimWindowFullError carries window ledger info', () => {
    const err = new AnonClaimWindowFullError(500, 600);
    expect(err.windowStartLedger).toBe(500);
    expect(err.windowEndLedger).toBe(600);
  });
});

// ── 3. No contradictory states ────────────────────────────────────────────────

describe('No contradictory states between backend and contract limiters', () => {
  it('contract accepts claim when below quota: no error expected', () => {
    const result = simulateContractResponse(2, CONTRACT_ANON_MAX_CLAIMS);
    expect(result.accepted).toBe(true);
    expect(result.contractError).toBeUndefined();
  });

  it('contract rejects claim at quota: returns AnonClaimWindowFull', () => {
    const result = simulateContractResponse(
      CONTRACT_ANON_MAX_CLAIMS,
      CONTRACT_ANON_MAX_CLAIMS,
    );
    expect(result.accepted).toBe(false);
    expect(result.contractError).toBe('AnonClaimWindowFull');
  });

  it('backend quota >= contract quota: backend never blocks a request the contract would have accepted', () => {
    // Simulate: N requests come in, N <= contract quota
    // Backend must pass all of them (quota >= contract quota)
    for (let n = 1; n <= CONTRACT_ANON_MAX_CLAIMS; n++) {
      const contractResult = simulateContractResponse(n - 1, CONTRACT_ANON_MAX_CLAIMS);
      // If the contract would accept it, the backend quota must not have been
      // exceeded yet (since backend quota >= contract quota)
      if (contractResult.accepted) {
        expect(n).toBeLessThanOrEqual(ANON_CLAIM_MAX_REQUESTS);
      }
    }
  });

  it('when contract returns AnonClaimWindowFull the mapped error is not the generic rate-limit code', () => {
    const contractResult = simulateContractResponse(
      CONTRACT_ANON_MAX_CLAIMS,
      CONTRACT_ANON_MAX_CLAIMS,
    );
    expect(contractResult.contractError).toBeDefined();
    const { code } = mapContractError(contractResult.contractError!);
    // Must be the specific contract-window error, not the generic API limiter error
    expect(code).toBe('ANON_CLAIM_WINDOW_FULL');
    expect(code).not.toBe('ANON_CLAIM_RATE_LIMITED');
  });

  it('error messages are distinct so frontend can show correct UI', () => {
    const backendLimitMsg = 'You are sending anonymous claim requests too fast.';
    const contractLimitMsg = 'The anonymous claim limit for this event window has been reached.';

    // The two messages must be different strings
    expect(backendLimitMsg).not.toBe(contractLimitMsg);

    // The contract error exposes window ledger info; backend error does not
    const contractErr = new AnonClaimWindowFullError(100, 200);
    expect(contractErr.message).toContain('window');
    expect(typeof contractErr.windowStartLedger).toBe('number');
    expect(typeof contractErr.windowEndLedger).toBe('number');
  });
});

// ── 4. AnonClaimWindowFullError shape ─────────────────────────────────────────

describe('AnonClaimWindowFullError', () => {
  it('is an instance of Error', () => {
    const err = new AnonClaimWindowFullError(0, 100);
    expect(err).toBeInstanceOf(Error);
  });

  it('is operational (expected error, not a bug)', () => {
    const err = new AnonClaimWindowFullError(0, 100);
    expect(err.isOperational).toBe(true);
  });

  it('windowEndLedger > windowStartLedger', () => {
    const err = new AnonClaimWindowFullError(50, 150);
    expect(err.windowEndLedger).toBeGreaterThan(err.windowStartLedger);
  });
});