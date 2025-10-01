import crypto from 'crypto';

export const generateMagicToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const MAGIC_TOKEN_EXPIRATION = 15 * 60 * 1000; // 15 minutes
