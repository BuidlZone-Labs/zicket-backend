import app from './app';
import config from './config/config';
import { mongoConnect } from './config/db.mongo';
import queueService from './services/queue.service';
import emailWorker from './workers/email.worker';
import zkEmailWorker from './workers/zkemail.worker';

async function startServer() {
  try {
    // Connect to MongoDB
    await mongoConnect();
    console.log('✓ MongoDB connected');

    // Initialize queue service
    await queueService.initialize();
    console.log('✓ Queue service initialized');

    // Initialize email worker
    await emailWorker.initialize();
    console.log('✓ Email worker initialized');

    // Initialize zkEmail worker
    await zkEmailWorker.initialize();
    console.log('✓ zkEmail worker initialized');

    // Start Express server
    const server = app.listen(config.port, () => {
      console.log(`✓ Server running on port ${config.port}`);
    });

    // Graceful shutdown
    const gracefulShutdown = async () => {
      console.log('\n🛑 Shutting down gracefully...');
      server.close(async () => {
        console.log('Express server stopped');
        await emailWorker.close();
        await zkEmailWorker.close();
        await queueService.close();
        console.log('All services closed');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
module.exports = app;
