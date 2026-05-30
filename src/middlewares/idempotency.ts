import { RequestHandler } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Idempotency Middleware
 *
 * Extracts or generates an idempotency key from request headers.
 * The key is attached to req.body for later use in duplicate detection.
 *
 * Clients should send: Idempotency-Key: <uuid>
 * If not provided, one will be generated (for non-idempotent operations, this still helps with deduplication).
 *
 * Reference: https://stripe.com/docs/api/idempotent_requests
 */

export interface IdempotentRequest extends Express.Request {
  idempotencyKey?: string;
}

export const idempotencyMiddleware: RequestHandler = (req, res, next) => {
  // Extract idempotency key from header (case-insensitive)
  let key = (req.headers['idempotency-key'] as string)?.trim();

  // If not provided, generate one for tracking
  if (!key) {
    key = uuidv4();
  }

  // Validate format (should be a valid UUID or similar)
  if (!/^[a-f0-9-]{36}$|^[\w-]{20,}$/.test(key)) {
    return res.status(400).json({
      error: 'Invalid Idempotency-Key format',
      message: 'Idempotency-Key must be a valid UUID or alphanumeric string',
    });
  }

  // Attach to request for downstream handlers
  (req as IdempotentRequest).idempotencyKey = key;

  // For safety, include in response headers so client can track
  res.setHeader('Idempotency-Key', key);

  next();
};

/**
 * Extract idempotency key from request
 */
export function getIdempotencyKey(req: any): string {
  return req.idempotencyKey || (req.headers['idempotency-key'] as string) || '';
}
