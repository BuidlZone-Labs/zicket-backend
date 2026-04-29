/**
 * Duplicate Payment Prevention Utilities
 *
 * Provides functions for handling idempotency keys, duplicate detection,
 * and safe retry mechanisms for payment processing.
 */

import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';

/**
 * Generate a deterministic idempotency key from payment details
 * Used for webhook events where a client-provided key doesn't exist
 */
export function generateDeterministicKey(
  txHash: string,
  userId: string,
  eventTicketId: string,
  amount: number,
): string {
  // Create a deterministic hash from payment details
  const input = `${txHash}:${userId}:${eventTicketId}:${amount}`;
  return createHash('sha256').update(input).digest('hex').slice(0, 32);
}

/**
 * Validate idempotency key format
 * Accepts UUID or 32-char hex strings
 */
export function isValidIdempotencyKey(key: string): boolean {
  if (!key) return false;
  // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  // Or hex string: 32 character hex
  const uuidRegex = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  const hexRegex = /^[a-f0-9]{32}$/i;
  return uuidRegex.test(key) || hexRegex.test(key);
}

/**
 * Create a duplicate prevention response
 * Indicates that a request was a retry of a successful payment
 */
export interface DuplicatePaymentResponse {
  isDuplicate: true;
  transactionId: string;
  orderId?: string;
  message: string;
  timestamp: Date;
}

/**
 * Attempt to extract user ID from various request contexts
 */
export function extractUserId(
  req: any,
): string | null {
  return req.user?._id ||
    (req.user as any)?.id ||
    req.userId ||
    null;
}
