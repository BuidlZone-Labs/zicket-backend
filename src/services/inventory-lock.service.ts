import Redis from 'redis';
import { redisConfig } from '../config/queue';

/**
 * #80 — Distributed Inventory Locking Service
 *
 * Provides Redis-based distributed locks to prevent race conditions
 * when multiple users attempt to purchase tickets concurrently.
 *
 * Features:
 * - Distributed locking across multiple server instances
 * - Automatic lock expiration (prevents deadlocks)
 * - Retry mechanism with exponential backoff
 */

export interface LockOptions {
  ttlMs?: number; // Time-to-live in milliseconds
  retryAttempts?: number;
  retryDelayMs?: number;
}

export interface LockResult {
  success: boolean;
  lockKey?: string;
  error?: string;
}

export class InventoryLockService {
  private static redisClient: Redis.RedisClientType | null = null;
  private static readonly DEFAULT_TTL_MS = 30000; // 30 seconds
  private static readonly DEFAULT_RETRY_ATTEMPTS = 3;
  private static readonly DEFAULT_RETRY_DELAY_MS = 100;

  /**
   * Initialize Redis connection
   */
  private static getClient(): Redis.RedisClientType {
    if (!InventoryLockService.redisClient) {
      InventoryLockService.redisClient = Redis.createClient(redisConfig);

      InventoryLockService.redisClient.on('error', (err) => {
        console.error('[InventoryLockService] Redis error:', err);
      });

      // Connect if not already connected
      if (!InventoryLockService.redisClient.isOpen) {
        InventoryLockService.redisClient.connect().catch((err) => {
          console.error('[InventoryLockService] Failed to connect:', err);
        });
      }
    }
    return InventoryLockService.redisClient;
  }

  /**
   * Generate a consistent lock key for an event ticket
   */
  private static getLockKey(eventTicketId: string): string {
    return `inventory:lock:${eventTicketId}`;
  }

  /**
   * Acquire a distributed lock for an event ticket
   *
   * @param eventTicketId - The event ticket ID to lock
   * @param options - Lock options (TTL, retry settings)
   * @returns LockResult indicating success/failure
   */
  static async acquireLock(
    eventTicketId: string,
    options: LockOptions = {},
  ): Promise<LockResult> {
    const {
      ttlMs = InventoryLockService.DEFAULT_TTL_MS,
      retryAttempts = InventoryLockService.DEFAULT_RETRY_ATTEMPTS,
      retryDelayMs = InventoryLockService.DEFAULT_RETRY_DELAY_MS,
    } = options;

    const lockKey = InventoryLockService.getLockKey(eventTicketId);
    const lockValue = `${Date.now()}:${Math.random().toString(36).substring(7)}`;

    const client = InventoryLockService.getClient();

    for (let attempt = 0; attempt < retryAttempts; attempt++) {
      try {
        // Use SET with NX (only if not exists) and PX (expiration)
        const result = await client.set(lockKey, lockValue, {
          NX: true,
          PX: ttlMs,
        });

        if (result === 'OK') {
          return {
            success: true,
            lockKey: lockValue,
          };
        }

        // Lock is held by another process, wait and retry
        if (attempt < retryAttempts - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, retryDelayMs * Math.pow(2, attempt)),
          );
        }
      } catch (error) {
        console.error(
          `[InventoryLockService] Lock acquisition error for ${eventTicketId}:`,
          error,
        );
        return {
          success: false,
          error: `Redis error: ${error instanceof Error ? error.message : 'Unknown'}`,
        };
      }
    }

    return {
      success: false,
      error: `Could not acquire lock after ${retryAttempts} attempts`,
    };
  }

  /**
   * Release a distributed lock
   *
   * @param eventTicketId - The event ticket ID to unlock
   * @param lockKey - The lock key value returned from acquireLock
   * @returns boolean indicating success
   */
  static async releaseLock(
    eventTicketId: string,
    lockKey: string,
  ): Promise<boolean> {
    const redisKey = InventoryLockService.getLockKey(eventTicketId);
    const client = InventoryLockService.getClient();

    try {
      // Use Lua script to ensure we only delete if we own the lock
      const luaScript = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;

      const result = await client.eval(luaScript, {
        keys: [redisKey],
        arguments: [lockKey],
      });

      return result === 1;
    } catch (error) {
      console.error(
        `[InventoryLockService] Lock release error for ${eventTicketId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Extend the TTL of an existing lock
   *
   * @param eventTicketId - The event ticket ID
   * @param lockKey - The lock key value
   * @param additionalTtlMs - Additional time to add
   * @returns boolean indicating success
   */
  static async extendLock(
    eventTicketId: string,
    lockKey: string,
    additionalTtlMs: number,
  ): Promise<boolean> {
    const redisKey = InventoryLockService.getLockKey(eventTicketId);
    const client = InventoryLockService.getClient();

    try {
      // Use Lua script to ensure we only extend if we own the lock
      const luaScript = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("pexpire", KEYS[1], ARGV[2])
        else
          return 0
        end
      `;

      const result = await client.eval(luaScript, {
        keys: [redisKey],
        arguments: [lockKey, additionalTtlMs.toString()],
      });

      return result === 1;
    } catch (error) {
      console.error(
        `[InventoryLockService] Lock extend error for ${eventTicketId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Execute a function with a distributed lock
   * Automatically acquires lock, executes function, and releases lock
   *
   * @param eventTicketId - The event ticket ID to lock
   * @param fn - Function to execute while holding the lock
   * @param options - Lock options
   * @returns Result of the function execution
   */
  static async withLock<T>(
    eventTicketId: string,
    fn: () => Promise<T>,
    options: LockOptions = {},
  ): Promise<T> {
    const lockResult = await InventoryLockService.acquireLock(
      eventTicketId,
      options,
    );

    if (!lockResult.success) {
      throw new Error(
        `Failed to acquire inventory lock: ${lockResult.error}`,
      );
    }

    try {
      return await fn();
    } finally {
      await InventoryLockService.releaseLock(
        eventTicketId,
        lockResult.lockKey!,
      );
    }
  }

  /**
   * Check if a lock exists (useful for debugging/monitoring)
   */
  static async isLocked(eventTicketId: string): Promise<boolean> {
    const redisKey = InventoryLockService.getLockKey(eventTicketId);
    const client = InventoryLockService.getClient();

    try {
      const result = await client.exists(redisKey);
      return result === 1;
    } catch (error) {
      console.error(
        `[InventoryLockService] Check lock error for ${eventTicketId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Get remaining TTL of a lock in milliseconds
   */
  static async getLockTtl(eventTicketId: string): Promise<number> {
    const redisKey = InventoryLockService.getLockKey(eventTicketId);
    const client = InventoryLockService.getClient();

    try {
      const result = await client.pTTL(redisKey);
      return result; // -1 if no TTL, -2 if key doesn't exist
    } catch (error) {
      console.error(
        `[InventoryLockService] Get TTL error for ${eventTicketId}:`,
        error,
      );
      return -2;
    }
  }
}

export default InventoryLockService;
