import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { IUser } from '../models/user';

// Magic link token utilities
export const generateMagicToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const MAGIC_TOKEN_EXPIRATION = 15 * 60 * 1000; // 15 minutes

// JWT token utilities
export const JWT_ACCESS_TOKEN_EXPIRY = '1h'; // 1 hour - balances security with user convenience

/**
 * Generates a JWT access token for authenticated users
 *
 * @param user - The authenticated user document
 * @returns Signed JWT token string
 *
 * Payload includes:
 * - id: User's MongoDB _id for database lookups
 * - email: User's email for identification and potential email-based operations
 *
 * Token expires after 1 hour to limit exposure if compromised while
 * maintaining reasonable session length for typical user workflows
 */
export const generateAccessToken = (user: IUser): string => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  return jwt.sign(
    {
      id: (user as any)._id,
      email: user.email,
    },
    secret,
    { expiresIn: JWT_ACCESS_TOKEN_EXPIRY },
  );
};
