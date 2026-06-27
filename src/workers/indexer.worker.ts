import indexerService from '../services/indexer.service';

export class IndexerWorker {
  private static instance: IndexerWorker;
  private intervalId?: NodeJS.Timeout;

  // Default to 15 seconds polling
  private pollInterval = parseInt(
    process.env.INDEXER_POLL_INTERVAL || '15000',
    10,
  );

  private constructor() {}

  static getInstance(): IndexerWorker {
    if (!this.instance) this.instance = new IndexerWorker();
    return this.instance;
  }

  async initialize() {
    console.log('[IndexerWorker] Initializing event indexer...');

    // Initial sync to catch up on any missed blocks
    await indexerService.syncEvents();

    // Start polling for new blocks
    this.intervalId = setInterval(async () => {
      try {
        await indexerService.syncEvents();
      } catch (err) {
        console.error('[IndexerWorker] Error during sync loop:', err);
      }
    }, this.pollInterval);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}

export default IndexerWorker.getInstance();
