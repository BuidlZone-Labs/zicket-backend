import { RequestHandler } from 'express';
import { RecommendationService } from '../services/recommendation.service';

/**
 * #84 — Event Recommendation Controller
 *
 * GET /api/recommendations?location=Lagos&category=Web3&limit=10
 *
 * Privacy contract:
 *  - location comes from the request query, not any stored user profile
 *  - no userId is read or written
 *  - the server logs nothing user-identifying
 */
export const getRecommendations: RequestHandler = async (req, res) => {
  try {
    const location = (req.query.location as string | undefined)?.trim();
    const category = (req.query.category as string | undefined)?.trim();
    const limit = parseInt(req.query.limit as string, 10) || 10;

    if (limit < 1 || limit > 20) {
      return res.status(400).json({
        error: 'Invalid limit',
        message: 'limit must be between 1 and 20',
      });
    }

    const result = await RecommendationService.getRecommendations(
      location,
      category,
      limit,
    );

    // Strip internal "source" field before sending to client
    const { source: _source, ...publicResult } = result;

    res.status(200).json({ success: true, data: publicResult });
  } catch (error) {
    console.error('[RecommendationController] Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message:
        error instanceof Error ? error.message : 'Failed to fetch recommendations',
    });
  }
};