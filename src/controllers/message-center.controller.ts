import { RequestHandler } from 'express';
import {
  MessageCenterService,
  CreateMessagePayload,
} from '../services/message-center.service';

function validateCreateMessageBody(
  body: unknown,
):
  | { valid: false; error: string }
  | { valid: true; payload: CreateMessagePayload } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.audience)) {
    return {
      valid: false,
      error: 'audience is required and must be an array of strings',
    };
  }
  if (b.audience.length === 0) {
    return { valid: false, error: 'audience must contain at least one item' };
  }
  if (!b.audience.every((a: unknown) => typeof a === 'string')) {
    return { valid: false, error: 'audience must contain only strings' };
  }
  if (typeof b.title !== 'string' || b.title.trim() === '') {
    return {
      valid: false,
      error: 'title is required and must be a non-empty string',
    };
  }
  if (typeof b.content !== 'string' || b.content.trim() === '') {
    return {
      valid: false,
      error: 'content is required and must be a non-empty string',
    };
  }
  if (b.scheduledAt !== undefined && b.scheduledAt !== null) {
    if (typeof b.scheduledAt !== 'string') {
      return {
        valid: false,
        error: 'scheduledAt must be an ISO 8601 date string if provided',
      };
    }
    const date = new Date(b.scheduledAt);
    if (Number.isNaN(date.getTime())) {
      return { valid: false, error: 'scheduledAt must be a valid date' };
    }
  }
  const payload: CreateMessagePayload = {
    audience: b.audience as string[],
    title: (b.title as string).trim(),
    content: (b.content as string).trim(),
  };
  if (b.scheduledAt !== undefined && b.scheduledAt !== null) {
    payload.scheduledAt = b.scheduledAt as string;
  }
  return { valid: true, payload };
}

const parsePage = (rawPage: unknown): number | null => {
  if (rawPage === undefined) {
    return 1;
  }

  if (typeof rawPage !== 'string' || !/^\d+$/.test(rawPage)) {
    return null;
  }

  const page = parseInt(rawPage, 10);
  return page > 0 ? page : null;
};

export const sendMessage: RequestHandler = async (req, res) => {
  const validation = validateCreateMessageBody(req.body);
  if (!validation.valid) {
    return res.status(400).json({
      error: 'Validation error',
      message: validation.error,
    });
  }
  try {
    const message = await MessageCenterService.createMessage(
      validation.payload,
    );
    return res.status(201).json(message);
  } catch (error) {
    console.error('Error creating message-center message:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message:
        error instanceof Error ? error.message : 'Failed to create message',
    });
  }
};

export const getPastMessages: RequestHandler = async (req, res) => {
  try {
    const page = parsePage(req.query.page);

    if (page === null) {
      return res.status(400).json({
        error: 'Invalid page number',
        message: 'Page must be a positive integer',
      });
    }

    const result = await MessageCenterService.getPastMessages(page);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching past message-center messages:', error);

    return res.status(500).json({
      error: 'Internal server error',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to fetch past message-center messages',
    });
  }
};

export const getScheduledMessages: RequestHandler = async (req, res) => {
  try {
    const page = parsePage(req.query.page);

    if (page === null) {
      return res.status(400).json({
        error: 'Invalid page number',
        message: 'Page must be a positive integer',
      });
    }

    const result = await MessageCenterService.getScheduledMessages(page);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching scheduled message-center messages:', error);

    return res.status(500).json({
      error: 'Internal server error',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to fetch scheduled message-center messages',
    });
  }
};
