import {
  nullifierToBytes32,
  nullifierToCanonicalHex,
} from '../src/utils/nullifier-bytes';

describe('nullifier-bytes', () => {
  it('canonicalizes equivalent decimal encodings to the same hex', () => {
    expect(nullifierToCanonicalHex('1')).toBe(nullifierToCanonicalHex('01'));
  });

  it('rejects nullifiers larger than 32 bytes', () => {
    const oversized = (1n << 256n).toString();
    expect(() => nullifierToCanonicalHex(oversized)).toThrow(
      'Nullifier exceeds 32 bytes',
    );
  });

  it('produces a 32-byte buffer for Soroban submission', () => {
    expect(nullifierToBytes32('42').length).toBe(32);
  });
});
