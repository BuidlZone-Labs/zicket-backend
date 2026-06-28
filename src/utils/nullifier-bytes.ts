/**
 * Canonical 32-byte nullifier encoding shared by Mongo digest and Soroban submit (#121).
 * Ensures equivalent decimal encodings (e.g. "1" vs "01") map to the same value.
 */
export function nullifierToCanonicalHex(nullifier: string): string {
  const value = BigInt(nullifier);
  if (value < 0n) {
    throw new Error('Nullifier must be non-negative');
  }
  const hex = value.toString(16);
  if (hex.length > 64) {
    throw new Error('Nullifier exceeds 32 bytes');
  }
  return hex.padStart(64, '0');
}
export function nullifierToCanonicalHex(nullifier: string): string {
  const value = BigInt(nullifier);
  if (value < 0n) {
    throw new Error('Nullifier must be non-negative');
  }
  const hex = value.toString(16);
  if (hex.length > 64) {
    throw new Error('Nullifier exceeds 32 bytes');
  }
  return hex.padStart(64, '0');
}

/**
 * Converts a zkPassport nullifier public signal to a 32-byte buffer for Soroban BytesN<32>.
 */
export function nullifierToBytes32(nullifier: string): Buffer {
  const buf = Buffer.from(nullifierToCanonicalHex(nullifier), 'hex');
  if (buf.length !== 32) {
    throw new Error('Nullifier must encode to exactly 32 bytes');
  }
  return buf;
}
