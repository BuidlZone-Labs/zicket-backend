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
