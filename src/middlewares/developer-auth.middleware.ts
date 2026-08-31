import { Request, RequestHandler } from 'express';
import bcrypt from 'bcrypt';
import DeveloperApiKey, {
  DeveloperApiPermission,
} from '../models/developer-key';
import { extractDeveloperApiKeyPrefix } from '../utils/developer-api-key';
import { UnauthorizedError, ForbiddenError } from '../errors/AppError';
import logger from '../utils/logger';

export const DEVELOPER_API_KEY_HEADER = 'x-zicket-api-key';

export interface DeveloperAuthContext {
  apiKeyId: string;
  organizerId: string;
  permissions: DeveloperApiPermission[];
  rateLimit: { windowMs: number; maxRequests: number };
}

export interface DeveloperAuthenticatedReq extends Request {
  developer?: DeveloperAuthContext;
}

/**
 * BR-09 / Section 12 — Developer Infrastructure API authentication.
 *
 * Validates the `X-Zicket-API-Key` header against `DeveloperApiKey`:
 *   1. Extract the key's non-secret prefix and look up the candidate
 *      document (indexed, O(1)) — never scans/compares against every key.
 *   2. bcrypt-compare the full raw key against the stored hash.
 *   3. Reject revoked/expired keys.
 *   4. Optionally require a specific permission scope for the route.
 *
 * On success, attaches `req.developer` with the organizer/permission
 * context used downstream by the rate limiter and route handlers.
 *
 * Errors are AppError subclasses so they flow through the existing
 * `globalErrorHandler` and come back as the standard
 * `{ status, message, code }` shape used everywhere else in the API.
 */
export function developerAuthGuard(
  requiredPermission?: DeveloperApiPermission,
): RequestHandler {
  return async (req, _res, next) => {
    try {
      const headerValue = req.headers[DEVELOPER_API_KEY_HEADER];
      const rawKey = Array.isArray(headerValue) ? headerValue[0] : headerValue;

      if (!rawKey || typeof rawKey !== 'string') {
        throw new UnauthorizedError(
          `Missing ${DEVELOPER_API_KEY_HEADER} header`,
        );
      }

      const keyPrefix = extractDeveloperApiKeyPrefix(rawKey);
      if (!keyPrefix) {
        throw new UnauthorizedError('Malformed API key');
      }

      const apiKey = await DeveloperApiKey.findOne({ keyPrefix }).select(
        '+hashedKey',
      );
      if (!apiKey) {
        throw new UnauthorizedError('Invalid API key');
      }

      if (apiKey.status !== 'active') {
        throw new UnauthorizedError('API key has been revoked');
      }

      if (apiKey.expiresAt && apiKey.expiresAt.getTime() < Date.now()) {
        throw new UnauthorizedError('API key has expired');
      }

      const isValid = await bcrypt.compare(rawKey, apiKey.hashedKey);
      if (!isValid) {
        throw new UnauthorizedError('Invalid API key');
      }

      if (
        requiredPermission &&
        !apiKey.permissions.includes(requiredPermission)
      ) {
        throw new ForbiddenError(
          `This API key does not have the '${requiredPermission}' permission`,
        );
      }

      // Best-effort usage tracking — never blocks the request on failure.
      DeveloperApiKey.updateOne(
        { _id: apiKey._id },
        { $set: { lastUsedAt: new Date() } },
      ).catch((err) => {
        logger.error('[developerAuthGuard] failed to record lastUsedAt:', err);
      });

      (req as DeveloperAuthenticatedReq).developer = {
        apiKeyId: apiKey._id.toString(),
        organizerId: apiKey.organizerId.toString(),
        permissions: apiKey.permissions,
        rateLimit: {
          windowMs: apiKey.rateLimit.windowMs,
          maxRequests: apiKey.rateLimit.maxRequests,
        },
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}
