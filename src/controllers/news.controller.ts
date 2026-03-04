import { RequestHandler } from 'express';
import mongoose from 'mongoose';
import { NewsService } from '../services/news.service';

export const incrementReadCount: RequestHandler = async (req, res) => {
  const rawId = req.params.id;
  const id =
    typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : '';

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      error: 'Invalid news ID',
      message: 'News ID must be a valid 24-character hex string',
    });
  }

  try {
    const news = await NewsService.incrementReadCount(id);
    if (!news) {
      return res.status(404).json({
        error: 'Not found',
        message: 'News not found',
      });
    }
    return res.status(200).json(news);
  } catch (error) {
    console.error('Error incrementing read count:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message:
        error instanceof Error ? error.message : 'Failed to update read count',
    });
  }
};
