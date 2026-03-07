import { RequestHandler } from 'express';
import z, { ZodError } from 'zod';
import { NewsroomService } from '../services/news.service';
import { CreateNewsSchema } from '../validators/news.validator';

export const createNews: RequestHandler = async (req, res) => {
  try {
    const parsed = CreateNewsSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        messages: z.treeifyError(parsed.error),
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
        messages: z.treeifyError(error),
      });
    }

    return res.status(500).json({
      error: 'Internal server error',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to create news article',
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

    // Parse and validate pagination parameters
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

    // Validate sortOrder
    if (!['asc', 'desc'].includes(sortOrder)) {
      return res.status(400).json({
        error: 'Invalid sort order',
        message: 'sortOrder must be "asc" or "desc"',
      });
    }

    const result = await NewsroomService.getAllNews(
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
}
