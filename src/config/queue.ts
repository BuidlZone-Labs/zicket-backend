import Redis from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = Number(process.env.REDIS_PORT) || 6379;
const redisPassword = process.env.REDIS_PASSWORD;

/**
 * Redis client configuration for BullMQ
 */
export const redisConfig = {
  host: redisHost,
  port: redisPort,
  ...(redisPassword && { password: redisPassword }),
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  enableOfflineQueue: true,
};

/**
 * Create Redis connection for queue operations
 */
export const createRedisConnection = () => {
  const client = Redis.createClient(redisConfig);
  
  client.on('error', (err) => {
    console.error('Redis connection error:', err);
  });

  client.on('connect', () => {
    console.log('Redis connected successfully');
  });

  return client;
};

/**
 * Queue configuration settings
 */
export const queueConfig = {
  // Job retry settings
  defaultJobOptions: {
    attempts: 3, // Retry 3 times
    backoff: {
      type: 'exponential',
      delay: 2000, // Start at 2 seconds
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
    },
    removeOnFail: false, // Keep failed jobs for debugging
  },
  
  // Worker settings
  worker: {
    concurrency: 5, // Process 5 jobs concurrently
  },
};

export default {
  redisConfig,
  queueConfig,
};
