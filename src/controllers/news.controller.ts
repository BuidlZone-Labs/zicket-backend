import { RequestHandler } from 'express';
import { NewsService } from '../services/news.service';

/**
 * Soft delete a news article by ID
 * DELETE /api/news/:id
 */
export const deleteNewsById: RequestHandler = async (req, res) => {
  try {
    const id = req.params.id as string;

    // Validate ID parameter
    if (!id || id.trim() === '') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'News ID is required',
      });
    }

    // Call service to soft delete the news article
    const result = await NewsService.deleteNewsById(id);

    // Return success response
    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        newsId: result.newsId,
        deletedAt: result.deletedAt,
      },
    });
  } catch (error) {
    console.error('Error deleting news article:', error);

    // Handle specific error cases
    if (error instanceof Error) {
      if (error.message.includes('Invalid news ID format')) {
        return res.status(400).json({
          error: 'Invalid request',
          message: error.message,
        });
      }
      if (error.message.includes('News article not found')) {
        return res.status(404).json({
          error: 'Not found',
          message: error.message,
        });
      }
      if (error.message.includes('already been deleted')) {
        return res.status(409).json({
          error: 'Conflict',
          message: error.message,
        });
      }
    }

    // Return generic error response
    res.status(500).json({
      error: 'Internal server error',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to delete news article',
    });
  }
};

/**
 * Hard delete a news article by ID (requires soft delete first)
 * DELETE /api/news/:id/permanent
 */
export const hardDeleteNewsById: RequestHandler = async (req, res) => {
  try {
    const id = req.params.id as string;

    // Validate ID parameter
    if (!id || id.trim() === '') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'News ID is required',
      });
    }

    // Call service to hard delete the news article
    const result = await NewsService.hardDeleteNewsById(id);

    // Return success response
    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        newsId: result.newsId,
      },
    });
  } catch (error) {
    console.error('Error hard deleting news article:', error);

    // Handle specific error cases
    if (error instanceof Error) {
      if (error.message.includes('Invalid news ID format')) {
        return res.status(400).json({
          error: 'Invalid request',
          message: error.message,
        });
      }
      if (error.message.includes('News article not found')) {
        return res.status(404).json({
          error: 'Not found',
          message: error.message,
        });
      }
      if (error.message.includes('must be soft deleted')) {
        return res.status(400).json({
          error: 'Bad request',
          message: error.message,
        });
      }
    }

    // Return generic error response
    res.status(500).json({
      error: 'Internal server error',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to hard delete news article',
    });
  }
};

/**
 * Restore a soft-deleted news article
 * PATCH /api/news/:id/restore
 */
export const restoreNewsById: RequestHandler = async (req, res) => {
  try {
    const id = req.params.id as string;

    // Validate ID parameter
    if (!id || id.trim() === '') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'News ID is required',
      });
    }

    // Call service to restore the news article
    const result = await NewsService.restoreNewsById(id);

    // Return success response
    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        newsId: result.newsId,
      },
    });
  } catch (error) {
    console.error('Error restoring news article:', error);

    // Handle specific error cases
    if (error instanceof Error) {
      if (error.message.includes('Invalid news ID format')) {
        return res.status(400).json({
          error: 'Invalid request',
          message: error.message,
        });
      }
      if (error.message.includes('News article not found')) {
        return res.status(404).json({
          error: 'Not found',
          message: error.message,
        });
      }
      if (error.message.includes('is not deleted')) {
        return res.status(409).json({
          error: 'Conflict',
          message: error.message,
        });
      }
    }

    // Return generic error response
    res.status(500).json({
      error: 'Internal server error',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to restore news article',
    });
  }
};
