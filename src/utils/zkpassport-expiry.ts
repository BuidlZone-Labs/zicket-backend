/**
 * Parses zkPassport expiration from public signals (index 2 per query-circuit layout).
 * Supports Unix seconds or YYYYMMDD packed integers (UTC end-of-day).
 */
export function extractZkPassportExpiryUnix(publicSignals: string[]): number | null {
  if (publicSignals.length < 3) {
    return null;
  }

  const raw = BigInt(publicSignals[2]);

  if (raw >= 1_000_000_000n && raw < 10_000_000_000n) {
    return Number(raw);
  }

  if (raw >= 19_000_101n && raw <= 99_99_12_31n) {
    const packed = raw.toString().padStart(8, '0');
    const year = parseInt(packed.slice(0, 4), 10);
    const month = parseInt(packed.slice(4, 6), 10) - 1;
    const day = parseInt(packed.slice(6, 8), 10);
    return Math.floor(Date.UTC(year, month, day, 23, 59, 59) / 1000);
  }

  return null;
}

/**
 * Returns true when the proof is expired at `nowMs` (defaults to current time).
 */
export function isZkPassportProofExpired(
  publicSignals: string[],
  nowMs: number = Date.now(),
): boolean {
  const expiryUnix = extractZkPassportExpiryUnix(publicSignals);
  if (expiryUnix === null) {
    return true;
  }
  return expiryUnix * 1000 < nowMs;
}
