import { RequestHandler } from 'express';
import z, { ZodError } from 'zod';
import { NewsNotFoundError, NewsroomService } from '../services/news.service';
import {
  CreateNewsSchema,
  NewsIdParamSchema,
  UpdateNewsSchema,
} from '../validators/news.validator';

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

    const updated = await NewsroomService.updateNews(
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
        message: error.message,
      });
    }

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
          : 'Failed to update news article',
    });
  }
};
