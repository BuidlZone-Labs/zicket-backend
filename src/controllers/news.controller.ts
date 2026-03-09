import { RequestHandler, Request, Response } from 'express';
import z, { ZodError } from 'zod';
import {
  NewsNotFoundError,
  NewsService,
} from '../services/news.service';
import {
  CreateNewsSchema,
  NewsIdParamSchema,
  UpdateNewsSchema,
  NewsSlugSchema,
} from '../validators/news.validator';

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

    const news = await NewsService.createNews(
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

export const updateNews: RequestHandler = async (req, res) => {
  try {
    const paramParsed = NewsIdParamSchema.safeParse(req.params);
    if (!paramParsed.success) {
      return res.status(400).json({
        error: 'Invalid request parameter',
        messages: z.treeifyError(paramParsed.error),
      });
    }

    const bodyParsed = UpdateNewsSchema.safeParse(req.body);
    if (!bodyParsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        messages: z.treeifyError(bodyParsed.error),
      });
    }

    if (Object.keys(bodyParsed.data).length === 0) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'At least one field must be provided for update',
      });
    }

    const imageFile = req.body.file as string | undefined;
    const imageUrl = req.body.imageUrl as string | undefined;

    const updated = await NewsService.updateNews(
      paramParsed.data.id,
      bodyParsed.data,
      imageFile,
      imageUrl,
    );

    return res.status(200).json({
      message: 'News article updated successfully',
      data: updated,
    });
  } catch (error) {
    console.error('Error updating news article:', error);

    if (error instanceof NewsNotFoundError) {
      return res.status(404).json({
        error: 'Not found',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to update news article',
      });
    }

    if (error instanceof ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        messages: z.treeifyError(error),
      });
    }
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

export const getAllNews: RequestHandler = async (req, res) => {
  try {
    const pageParam = req.query.page as string;
    const limitParam = req.query.limit as string;
    const category = (req.query.category as string) || undefined;
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'desc';

    const page = pageParam ? parseInt(pageParam) : 1;
    const limit = limitParam ? parseInt(limitParam) : 10;

    if (page < 1) {
      return res.status(400).json({
        error: 'Invalid pagination',
        message: 'Page must be at least 1',
      });
    }

    if (limit < 1 || limit > 100) {
      return res.status(400).json({
        error: 'Invalid pagination',
        message: 'Limit must be between 1 and 100',
      });
    }

    if (!['asc', 'desc'].includes(sortOrder)) {
      return res.status(400).json({
        error: 'Invalid sort order',
        message: 'sortOrder must be "asc" or "desc"',
      });
    }

    const result = await NewsService.getAllNews(
      page,
      limit,
      category,
      sortBy,
      sortOrder,
    );

    return res.status(200).json({
      message: 'News articles retrieved successfully',
      data: result.data,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        pages: result.pages,
      },
    });
  } catch (error) {
    console.error('Error retrieving news articles:', error);

    return res.status(500).json({
      error: 'Internal server error',
      message:
        error instanceof Error ? error.message : 'Failed to retrieve news',
    });
  }
};

export const getSingleNews: RequestHandler = async (req, res) => {
  const result = NewsSlugSchema.safeParse(req.params);
  if (!result.success) {
    return res.status(400).json({
      error: 'Validation error',
      message: result.error.issues[0]?.message || 'Invalid slug',
    });
  }

  try {
    const news = await NewsService.getSingleNewsBySlug(result.data.slug);

    if (!news) {
      return res.status(404).json({
        error: 'Not found',
        message: 'News article not found',
      });
    }

    return res.status(200).json(news);
  } catch (error) {
    console.error('Error fetching single news:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message:
        error instanceof Error ? error.message : 'Failed to fetch news article',
    });
  }
};
