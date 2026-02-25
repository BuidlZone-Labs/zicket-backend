import { RequestHandler } from 'express';
import { MessageCenterService } from '../services/message-center.service';

export const deleteMessageController: RequestHandler = async (req, res) => {
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
