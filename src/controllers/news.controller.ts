import { RequestHandler, Request, Response } from 'express';
import { NewsService, NewsroomService } from '../services/news.service';
import z, { ZodError } from 'zod';
import { CreateNewsSchema } from '../validators/news.validator';

/**
 * Soft delete a news article by ID
 * DELETE /api/news/:id
 */
export const deleteNewsById: RequestHandler = async (req, res) => {
  try {
    const id = req.params.id as string;

    if (!id || id.trim() === '') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'News ID is required',
      });
    }

    const result = await NewsService.deleteNewsById(id);

    return res.status(200).json({
      success: true,
      message: result.message,
      data: {
        newsId: result.newsId,
        deletedAt: result.deletedAt,
      },
    });
  } catch (error) {
    console.error('Error deleting news article:', error);

    if (error instanceof Error) {
      if (error.message.includes('Invalid news ID format')) {
        return res.status(400).json({ error: 'Invalid request', message: error.message });
      }
      if (error.message.includes('News article not found')) {
        return res.status(404).json({ error: 'Not found', message: error.message });
      }
      if (error.message.includes('already been deleted')) {
        return res.status(409).json({ error: 'Conflict', message: error.message });
      }
    }

    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Failed to delete news article',
    });
  }
};

/**
 * Create a news article
 * POST /api/news
 */
export const createNews: RequestHandler = async (req, res) => {
  try {
    const parsed = CreateNewsSchema.safeParse(req.body);

    if (!parsed.success) {
      // Note: z.treeifyError isn't a standard Zod method; 
      // typically you'd use parsed.error.flatten() or parsed.error.format()
      return res.status(400).json({
        error: 'Validation failed',
        messages: parsed.error.format(),
      });
    }

    const imageFile = req.body.file as string;
    const imageUrl = req.body.imageUrl as string;

    const news = await NewsroomService.createNews(
      parsed.data,
      imageFile,
      imageUrl,
    );

    return res.status(201).json({
      message: 'News article created successfully',
      data: news,
    });
  } catch (error) {
    console.error('Error creating news article:', error);

    if (error instanceof ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        messages: error.format(),
      });
    }

    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Failed to create news article',
    });
  }
};

/**
 * Hard delete a news article by ID (requires soft delete first)
 * DELETE /api/news/:id/permanent
 */
export const hardDeleteNewsById: RequestHandler = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    if (!id || id.trim() === '') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'News ID is required',
      });
    }

    const result = await NewsService.hardDeleteNewsById(id);

    return res.status(200).json({
      success: true,
      message: result.message,
      data: { newsId: result.newsId },
    });
  } catch (error) {
    console.error('Error hard deleting news article:', error);

    if (error instanceof Error) {
      if (error.message.includes('Invalid news ID format')) {
        return res.status(400).json({ error: 'Invalid request', message: error.message });
      }
      if (error.message.includes('News article not found')) {
        return res.status(404).json({ error: 'Not found', message: error.message });
      }
      if (error.message.includes('must be soft deleted')) {
        return res.status(400).json({ error: 'Bad request', message: error.message });
      }
    }

    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Failed to hard delete news article',
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

    if (!id || id.trim() === '') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'News ID is required',
      });
    }

    const result = await NewsService.restoreNewsById(id);

    return res.status(200).json({
      success: true,
      message: result.message,
      data: { newsId: result.newsId },
    });
  } catch (error) {
    console.error('Error restoring news article:', error);

    if (error instanceof Error) {
      if (error.message.includes('Invalid news ID format')) {
        return res.status(400).json({ error: 'Invalid request', message: error.message });
      }
      if (error.message.includes('News article not found')) {
        return res.status(404).json({ error: 'Not found', message: error.message });
      }
      if (error.message.includes('is not deleted')) {
        return res.status(409).json({ error: 'Conflict', message: error.message });
      }
    }

    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Failed to restore news article',
    });
  }
};