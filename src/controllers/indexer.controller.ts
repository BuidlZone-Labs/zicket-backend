import { Request, Response } from 'express';
import ContractEvent from '../models/contract-event';

export const getEvents = async (req: Request, res: Response) => {
  try {
    const { contractAddress, eventName, transactionHash, page = '1', limit = '50' } = req.query;

    const query: any = {};
    if (contractAddress) query.contractAddress = (contractAddress as string).toLowerCase();
    if (eventName) query.eventName = eventName;
    if (transactionHash) query.transactionHash = transactionHash;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const [events, total] = await Promise.all([
      ContractEvent.find(query)
        .sort({ blockNumber: -1, logIndex: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      ContractEvent.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: events,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('[IndexerController] Error fetching events:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch events' });
  }
};
