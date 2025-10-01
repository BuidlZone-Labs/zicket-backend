import { generateMagicToken, hashToken, MAGIC_TOKEN_EXPIRATION } from '../src/utils/token';

describe('Magic Link Token Utilities', () => {
  describe('generateMagicToken', () => {
    it('should generate a 64-character hex string', () => {
      const token = generateMagicToken();
      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate unique tokens', () => {
      const token1 = generateMagicToken();
      const token2 = generateMagicToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe('hashToken', () => {
    it('should hash a token to a 64-character hex string', () => {
      const token = 'test-token-123';
      const hashed = hashToken(token);
      expect(hashed).toHaveLength(64);
      expect(hashed).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce consistent hashes for the same input', () => {
      const token = 'test-token-123';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = hashToken('token1');
      const hash2 = hashToken('token2');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('MAGIC_TOKEN_EXPIRATION', () => {
    it('should be 15 minutes in milliseconds', () => {
      expect(MAGIC_TOKEN_EXPIRATION).toBe(15 * 60 * 1000);
      expect(MAGIC_TOKEN_EXPIRATION).toBe(900000);
    });
  });
});

