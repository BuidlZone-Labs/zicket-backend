import { RequestHandler } from 'express';
import mongoose from 'mongoose';
import { CreateMessagePayload, MessageCenterService, UpdateMessagePayload } from '../services/message-center.service';


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

export const deleteMessage: RequestHandler = async (req, res) => {
  try {
    const { messageId } = req.params;

    if (!messageId) {
      res.status(400).json({ message: 'messageId param is required' });
      return;
    }

    await MessageCenterService.deleteMessage(messageId as string);

    res.status(200).json({ message: 'Message deleted successfully' });
  } catch (error: any) {
    if (error.message === 'Message not found') {
      res.status(404).json({ message: error.message });
      return;
    }

    console.error('Error in deleteMessageController:', error.message);
    res.status(500).json({ message: 'An error occurred. Please try again.' });
  }
};

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

export const editMessage: RequestHandler = async (req, res) => {
  try {
    const rawId = req.params.messageId;
    const messageId =
      typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : '';
    const body = req.body as Record<string, unknown>;

    if (!messageId || !mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({
        error: 'Invalid message ID',
        message: 'Message ID must be a valid 24-character hex string',
      });
    }

    const payload: UpdateMessagePayload = {};
    if (body.title !== undefined) {
      if (typeof body.title !== 'string' || body.title.trim() === '') {
        return res.status(400).json({
          error: 'Invalid title',
          message: 'Title must be a non-empty string',
        });
      }
      payload.title = body.title;
    }
    if (body.content !== undefined) {
      if (typeof body.content !== 'string' || body.content.trim() === '') {
        return res.status(400).json({
          error: 'Invalid content',
          message: 'Content must be a non-empty string',
        });
      }
      payload.content = body.content;
    }
    if (body.scheduledAt !== undefined) {
      const date = new Date(body.scheduledAt as string);
      if (Number.isNaN(date.getTime())) {
        return res.status(400).json({
          error: 'Invalid scheduledAt',
          message: 'scheduledAt must be a valid ISO date string',
        });
      }
      payload.scheduledAt = date;
    }

    if (Object.keys(payload).length === 0) {
      return res.status(400).json({
        error: 'Invalid payload',
        message:
          'At least one of title, content, or scheduledAt must be provided',
      });
    }

    let result;
    try {
      result = await MessageCenterService.updateMessage(messageId, payload);
    } catch (err) {
      if (
        err instanceof Error &&
        err.message === 'ScheduledAtNotAllowedForSent'
      ) {
        return res.status(400).json({
          error: 'Invalid update',
          message: 'scheduledAt cannot be updated for sent messages',
        });
      }
      throw err;
    }

    if (result === null) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Message not found',
      });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error updating message-center message:', error);

    return res.status(500).json({
      error: 'Internal server error',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to update message-center message',
    });
  }
};
