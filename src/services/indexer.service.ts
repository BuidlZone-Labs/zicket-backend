import { ethers } from 'ethers';
import { BlockchainProvider } from '../provider/blockchain.provider';
import ContractEvent from '../models/contract-event';
import IndexerState from '../models/indexer-state';

export class IndexerService {
  private static instance: IndexerService;
  
  private contractAddress = (process.env.INDEXER_CONTRACT_ADDRESS || '').toLowerCase();
  private maxBlockRange = 2000;

  static getInstance(): IndexerService {
    if (!this.instance) this.instance = new IndexerService();
    return this.instance;
  }

  async syncEvents() {
    if (!this.contractAddress) {
      console.warn('[Indexer] No INDEXER_CONTRACT_ADDRESS configured. Skipping sync.');
      return;
    }

    try {
      const provider = BlockchainProvider.getInstance().getProvider();
      const currentBlock = await provider.getBlockNumber();
      
      let state = await IndexerState.findOne({ contractAddress: this.contractAddress });
      if (!state) {
        state = new IndexerState({
          contractAddress: this.contractAddress,
          lastIndexedBlock: currentBlock - 100, // Default to past 100 blocks
        });
      }

      let fromBlock = state.lastIndexedBlock + 1;
      
      if (fromBlock > currentBlock) {
        return; // Already up to date
      }

      while (fromBlock <= currentBlock) {
        let toBlock = fromBlock + this.maxBlockRange - 1;
        if (toBlock > currentBlock) toBlock = currentBlock;

        console.log(`[Indexer] Syncing events for ${this.contractAddress} from block ${fromBlock} to ${toBlock}`);

        const logs = await provider.getLogs({
          address: this.contractAddress,
          fromBlock,
          toBlock
        });

        if (logs.length > 0) {
          // Ideally fetch block timestamps here, but we'll use current date as fallback
          const eventsToSave = logs.map((log: any) => ({
            contractAddress: log.address.toLowerCase(),
            eventName: log.topics[0] || 'Unknown',
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
            logIndex: log.index,
            topics: log.topics,
            data: log.data,
            timestamp: new Date(), 
          }));

          try {
            await ContractEvent.insertMany(eventsToSave, { ordered: false });
          } catch (err: any) {
            // E11000 duplicate key error is expected if we re-index an overlapping range
            if (err.code !== 11000) {
              console.error('[Indexer] Error saving events:', err);
              throw err;
            }
          }
        }

        state.lastIndexedBlock = toBlock;
        await state.save();
        
        fromBlock = toBlock + 1;
      }
    } catch (error) {
      console.error('[Indexer] Sync failed:', error);
    }
  }
}

export default IndexerService.getInstance();
