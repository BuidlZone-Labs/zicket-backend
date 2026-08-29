import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { redisClient } from '../config/queue';

const router = Router();

const mongoStateMap: Record<number, string> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

router.get('/', async (req: Request, res: Response) => {
  const readyState = mongoose.connection.readyState;
  const mongoStatus = mongoStateMap[readyState] || 'unknown';

  let redisStatus = 'disconnected';
  try {
    if (redisClient && redisClient.status === 'ready') {
      redisStatus = 'connected';
    } else if (redisClient) {
      redisStatus = redisClient.status || 'unknown';
    }
  } catch (err) {
    redisStatus = 'error';
  }

  const isHealthy = readyState === 1 || readyState === 2;
  const statusCode = isHealthy ? 200 : 503;

  const responsePayload = {
    status: isHealthy ? 'ok' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'zicket-backend',
    environment: process.env.NODE_ENV || 'development',
    database: {
      provider: 'mongodb',
      status: mongoStatus,
      readyState,
    },
    redis: {
      status: redisStatus,
    },
    sorobanRpc: {
      network: process.env.STELLAR_NETWORK || 'testnet',
      status: 'configured',
    },
    memoryUsage: process.memoryUsage(),
  };

  return res.status(statusCode).json(responsePayload);
});

export default router;
