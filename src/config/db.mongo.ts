import mongoose from 'mongoose';
import logger from '../utils/logger';
require('dotenv').config();

let env = process.env.NODE_ENV;
let dbName: string;

if (env == 'development') {
  dbName = 'test';
} else if (env == 'production') {
  dbName = 'prod';
}

mongoose.connection.once('open', () => {
  logger.info('MongoDB connection established!');
});

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  logger.info('MongoDB connection disconnected.');
});

export async function mongoConnect() {
  if (mongoose.connection.readyState === 1) {
    // If connection already exists, reuse it.
    logger.info('MongoDB connection already exists, reusing it.');
    return;
  }

  await mongoose.connect(process.env.MONGO_URI!, {
    dbName: dbName,
    maxPoolSize: 5,
  });
  logger.info(`Connected to MongoDB with database name: ${dbName}`);
}

export async function mongoDisconnect() {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
}

// Handling app termination and closing connection gracefully
process.on('SIGINT', async () => {
  await mongoDisconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await mongoDisconnect();
  process.exit(0);
});
