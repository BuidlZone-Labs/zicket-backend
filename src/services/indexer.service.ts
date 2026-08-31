import { rpc, scValToNative } from '@stellar/stellar-sdk';
import ContractEvent from '../models/contract-event';
import IndexerState from '../models/indexer-state';
import logger from '../utils/logger';

export class IndexerService {
  private static instance: IndexerService;

  private contractAddress = (
    process.env.INDEXER_CONTRACT_ADDRESS || ''
  ).toLowerCase();
  private rpcUrl =
    process.env.SOROBAN_RPC_URL || process.env.BLOCKCHAIN_RPC_URL || '';
  private maxLedgerRange = 10000;
  private server: rpc.Server;

  private constructor() {
    this.server = new rpc.Server(this.rpcUrl);
  }

  static getInstance(): IndexerService {
    if (!this.instance) this.instance = new IndexerService();
    return this.instance;
  }

  async syncEvents() {
    if (!this.contractAddress || !this.rpcUrl) {
      logger.warn(
        '[Indexer] No INDEXER_CONTRACT_ADDRESS or SOROBAN_RPC_URL configured. Skipping sync.',
      );
      return;
    }

    try {
      const latestLedgerResponse = await this.executeWithRetry(() =>
        this.server.getLatestLedger(),
      );
      const currentLedger = latestLedgerResponse.sequence;

      let state = await IndexerState.findOne({
        contractAddress: this.contractAddress,
      });
      if (!state) {
        state = new IndexerState({
          contractAddress: this.contractAddress,
          lastIndexedLedger: currentLedger - 100,
        });
      }

      let fromLedger = state.lastIndexedLedger + 1;

      if (fromLedger > currentLedger) {
        return;
      }

      while (fromLedger <= currentLedger) {
        let toLedger = fromLedger + this.maxLedgerRange - 1;
        if (toLedger > currentLedger) toLedger = currentLedger;

        logger.info(
          `[Indexer] Syncing events for ${this.contractAddress} from ledger ${fromLedger} to ${toLedger}`,
        );
        let cursor: string | undefined = undefined;
        let hasMore = true;

        while (hasMore) {
          const requestParams: any = {
            filters: [
              {
                type: 'contract',
                contractIds: [this.contractAddress],
              },
            ],
            limit: 100,
          };
          if (cursor) {
            requestParams.cursor = cursor;
          } else {
            requestParams.startLedger = fromLedger;
          }

          const eventsResponse: rpc.Api.GetEventsResponse =
            await this.executeWithRetry(() =>
              this.server.getEvents(requestParams),
            );

          const events = eventsResponse.events || [];

          if (events.length === 0) {
            hasMore = false;
            break;
          }

          const eventsToProcess = events.filter((e) => e.ledger <= toLedger);

          if (eventsToProcess.length > 0) {
            const eventsToSave = eventsToProcess.map(
              (event: any, index: number) => {
                let parsedArgs = {};
                try {
                  if (event.value) {
                    parsedArgs = scValToNative(event.value);
                  }
                } catch (e) {
                  parsedArgs = {};
                }

                const topics = event.topic.map((t: any) => {
                  try {
                    const val = scValToNative(t);
                    return typeof val === 'string' ? val : JSON.stringify(val);
                  } catch (e) {
                    return '';
                  }
                });

                const eventName = topics.length > 0 ? topics[0] : 'Unknown';

                let eventIndex = index;
                if (
                  event.id &&
                  typeof event.id === 'string' &&
                  event.id.includes('-')
                ) {
                  const parts = event.id.split('-');
                  if (parts.length > 1) {
                    eventIndex = parseInt(parts[1], 10) || index;
                  }
                }

                return {
                  contractAddress: event.contractId
                    ? event.contractId.toString().toLowerCase()
                    : this.contractAddress,
                  eventName,
                  ledgerSequence: event.ledger,
                  transactionHash: event.txHash,
                  eventIndex,
                  topics,
                  data: JSON.stringify(parsedArgs),
                  args: parsedArgs,
                  timestamp: new Date(event.ledgerClosedAt),
                };
              },
            );

            for (const ev of eventsToSave) {
              try {
                await ContractEvent.updateOne(
                  {
                    transactionHash: ev.transactionHash,
                    ledgerSequence: ev.ledgerSequence,
                    eventIndex: ev.eventIndex,
                  },
                  { $setOnInsert: ev },
                  { upsert: true },
                );
              } catch (err: any) {
                if (err.code !== 11000) {
                  logger.error('[Indexer] Error saving event:', err);
                  throw err;
                }
              }
            }
          }

          const lastEvent = events[events.length - 1];
          if (lastEvent.ledger > toLedger) {
            hasMore = false;
          } else {
            cursor = eventsResponse.cursor;
          }
        }

        state.lastIndexedLedger = toLedger;
        await state.save();

        fromLedger = toLedger + 1;
      }
    } catch (error) {
      logger.error('[Indexer] Sync failed:', error);
    }
  }

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 5,
  ): Promise<T> {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        return await operation();
      } catch (error) {
        attempt++;
        if (attempt >= maxRetries) throw error;
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw new Error('Retry failed');
  }
}

export default IndexerService.getInstance();
