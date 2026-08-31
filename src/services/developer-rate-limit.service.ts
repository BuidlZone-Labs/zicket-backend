import Redis from 'redis';
import { redisConfig } from '../config/queue';
import logger from '../utils/logger';

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  remaining: number;
  /** Milliseconds until the current window resets. */
  retryAfterMs: number;
}

/**
 * BR-09 / Section 12 — Redis-backed rate limiting for the public
 * developer API. Uses a fixed-window counter (`INCR` + `PEXPIRE` on the
 * first hit) keyed per API key, so each developer key gets its own
 * independent budget regardless of source IP.
 *
 * Mirrors the connection pattern already used by
 * `InventoryLockService` (lazy singleton `redis` client, same
 * `redisConfig` from `src/config/queue.ts`) so this reuses the same
 * Redis deployment the queue/worker system already depends on — no new
 * infrastructure required.
 */
export class DeveloperRateLimitService {
  private static redisClient: Redis.RedisClientType | null = null;

  private static getClient(): Redis.RedisClientType {
    if (!DeveloperRateLimitService.redisClient) {
      DeveloperRateLimitService.redisClient = Redis.createClient(redisConfig);

      DeveloperRateLimitService.redisClient.on('error', (err) => {
        logger.error('[DeveloperRateLimitService] Redis error:', err);
      });

      if (!DeveloperRateLimitService.redisClient.isOpen) {
        DeveloperRateLimitService.redisClient.connect().catch((err) => {
          logger.error('[DeveloperRateLimitService] Failed to connect:', err);
        });
      }
    }
    return DeveloperRateLimitService.redisClient;
  }

  static getKey(apiKeyId: string): string {
    return `developer_api:rate_limit:${apiKeyId}`;
  }

  /**
   * Atomically increments the request counter for `apiKeyId` and reports
   * whether the request is within budget for the current window.
   *
   * Fails OPEN on Redis errors: a Redis outage degrades to "no rate
   * limiting" (logged loudly) rather than taking the entire public
   * developer API down. This matches the resilience posture already
   * used by other Redis-backed paths in this codebase (see
   * `InventoryLockService`) — availability of third-party integrations
   * takes priority over strict enforcement during an infra incident.
   */
  static async checkAndIncrement(
    apiKeyId: string,
    windowMs: number,
    maxRequests: number,
  ): Promise<RateLimitResult> {
    const key = DeveloperRateLimitService.getKey(apiKeyId);

    try {
      const client = DeveloperRateLimitService.getClient();

      const count = await client.incr(key);
      if (count === 1) {
        // Only the request that created the counter sets the expiry,
        // so concurrent requests can't repeatedly push the window back.
        await client.pExpire(key, windowMs);
      }

      const ttl = await client.pTTL(key);
      const retryAfterMs = ttl > 0 ? ttl : windowMs;

      return {
        allowed: count <= maxRequests,
        count,
        limit: maxRequests,
        remaining: Math.max(0, maxRequests - count),
        retryAfterMs,
      };
    } catch (error) {
      logger.error(
        '[DeveloperRateLimitService] Redis unavailable, failing open:',
        error,
      );
      return {
        allowed: true,
        count: 0,
        limit: maxRequests,
        remaining: maxRequests,
        retryAfterMs: 0,
      };
    }
  }

  /** Test/ops helper — clears a key's counter immediately. */
  static async reset(apiKeyId: string): Promise<void> {
    try {
      const client = DeveloperRateLimitService.getClient();
      await client.del(DeveloperRateLimitService.getKey(apiKeyId));
    } catch (error) {
      logger.error('[DeveloperRateLimitService] reset failed:', error);
    }
  }
}

export default DeveloperRateLimitService;
