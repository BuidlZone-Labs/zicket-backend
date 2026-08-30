import mongoose from 'mongoose';
import Redis from 'redis';
import { createRedisConnection } from '../config/queue';
import IndexerState from '../models/indexer-state';

/**
 * Health metrics response interface
 */
export interface HealthMetrics {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  service: string;
  database: {
    status: 'connected' | 'disconnected';
    responseTime?: number;
    poolSize?: number;
    message?: string;
  };
  redis: {
    status: 'connected' | 'disconnected';
    responseTime?: number;
    message?: string;
  };
  indexer: {
    status: 'healthy' | 'lagging' | 'unavailable';
    laggedContracts?: number;
    totalIndexedContracts?: number;
    message?: string;
  };
  queue?: {
    status: 'operational' | 'degraded';
    activeJobs?: number;
    failedJobs?: number;
    message?: string;
  };
}

class HealthService {
  private redisClient: Redis.RedisClient | null = null;

  /**
   * Initialize Redis client for health checks
   */
  async initializeRedis(): Promise<void> {
    if (!this.redisClient) {
      this.redisClient = createRedisConnection();
    }
  }

  /**
   * Check MongoDB connection and pool status
   */
  async checkDatabase(): Promise<HealthMetrics['database']> {
    try {
      const startTime = Date.now();
      
      // Check connection state
      const readyState = mongoose.connection.readyState;
      if (readyState !== 1) {
        return {
          status: 'disconnected',
          message: `MongoDB connection state: ${readyState}. Expected: 1 (connected), got: ${readyState}`,
        };
      }

      // Attempt a simple ping by checking connection stats
      const connectionTime = Date.now() - startTime;

      // Get pool stats from the connection
      const db = mongoose.connection.getClient();
      const poolStats = db?.topology?.s?.pool;

      return {
        status: 'connected',
        responseTime: connectionTime,
        poolSize: poolStats?.connectionCount || 0,
        message: 'MongoDB connected and operational',
      };
    } catch (error) {
      return {
        status: 'disconnected',
        message: `Database check failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Check Redis connection status
   */
  async checkRedis(): Promise<HealthMetrics['redis']> {
    try {
      await this.initializeRedis();
      
      if (!this.redisClient) {
        return {
          status: 'disconnected',
          message: 'Redis client not initialized',
        };
      }

      const startTime = Date.now();
      
      // Perform PING command to check connection
      const pong = await this.redisClient.ping();
      const responseTime = Date.now() - startTime;

      if (pong === 'PONG') {
        return {
          status: 'connected',
          responseTime,
          message: 'Redis connected and operational',
        };
      }

      return {
        status: 'disconnected',
        message: 'Redis PING returned unexpected response',
      };
    } catch (error) {
      return {
        status: 'disconnected',
        message: `Redis check failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Check indexer lag by comparing last indexed ledgers across contracts
   */
  async checkIndexerHealth(): Promise<HealthMetrics['indexer']> {
    try {
      // Get all indexed contracts
      const indexerStates = await IndexerState.find({}).lean();

      if (indexerStates.length === 0) {
        return {
          status: 'unavailable',
          totalIndexedContracts: 0,
          message: 'No contracts are currently indexed',
        };
      }

      // Calculate lag - check if any contract is significantly behind
      // Assume "lagging" if a contract hasn't been updated in more than 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const laggedContracts = indexerStates.filter((state) => {
        return new Date(state.updatedAt) < fiveMinutesAgo;
      }).length;

      const lagPercentage = (laggedContracts / indexerStates.length) * 100;

      if (lagPercentage > 50) {
        return {
          status: 'lagging',
          laggedContracts,
          totalIndexedContracts: indexerStates.length,
          message: `${lagPercentage.toFixed(1)}% of contracts are lagging (not updated in 5+ minutes)`,
        };
      }

      return {
        status: 'healthy',
        laggedContracts,
        totalIndexedContracts: indexerStates.length,
        message: `Indexer healthy. ${indexerStates.length} contracts indexed, ${laggedContracts} lagging`,
      };
    } catch (error) {
      return {
        status: 'unavailable',
        message: `Indexer check failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Get comprehensive health metrics
   */
  async getHealthMetrics(): Promise<HealthMetrics> {
    const startTime = Date.now();

    // Perform all checks in parallel
    const [database, redis, indexer] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkIndexerHealth(),
    ]);

    // Determine overall health status
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (database.status === 'disconnected' || redis.status === 'disconnected') {
      overallStatus = 'unhealthy';
    } else if (indexer.status === 'lagging') {
      overallStatus = 'degraded';
    }

    const metrics: HealthMetrics = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: 'zicket-backend',
      database,
      redis,
      indexer,
    };

    return metrics;
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.redisClient) {
      try {
        await this.redisClient.quit();
        this.redisClient = null;
      } catch (error) {
        console.error('Error closing Redis connection:', error);
      }
    }
  }
}

// Export singleton instance
export default new HealthService();
