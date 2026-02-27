import {
  sendMessage,
  getPastMessages,
  getScheduledMessages,
} from '../src/controllers/message-center.controller';
import { MessageCenterService } from '../src/services/message-center.service';

jest.mock('../src/services/message-center.service', () => ({
  MessageCenterService: {
    createMessage: jest.fn(),
    getPastMessages: jest.fn(),
    getScheduledMessages: jest.fn(),
    updateMessage: jest.fn(),
  },
}));

describe('message-center controller', () => {
  const messageCenterService = MessageCenterService as unknown as {
    createMessage: jest.Mock;
    getPastMessages: jest.Mock;
    getScheduledMessages: jest.Mock;
    updateMessage: jest.Mock;
  };

  const createResponse = () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    return res;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendMessage', () => {
    it('returns 400 when body is missing', async () => {
      const req = { body: undefined };
      const res = createResponse();
      await sendMessage(req as any, res as any, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Validation error',
        message: 'Request body must be a JSON object',
      });
      expect(messageCenterService.createMessage).not.toHaveBeenCalled();
    });

    it('returns 400 when audience is not an array', async () => {
      const req = { body: { audience: 'all', title: 'Hi', content: 'Hello' } };
      const res = createResponse();
      await sendMessage(req as any, res as any, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Validation error',
        message: 'audience is required and must be an array of strings',
      });
      expect(messageCenterService.createMessage).not.toHaveBeenCalled();
    });

    it('returns 400 when audience is empty', async () => {
      const req = { body: { audience: [], title: 'Hi', content: 'Hello' } };
      const res = createResponse();
      await sendMessage(req as any, res as any, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Validation error',
        message: 'audience must contain at least one item',
      });
    });

    it('returns 400 when title is missing or empty', async () => {
      const req = {
        body: { audience: ['a'], title: '  ', content: 'Hello' },
      };
      const res = createResponse();
      await sendMessage(req as any, res as any, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Validation error',
        message: 'title is required and must be a non-empty string',
      });
    });

    it('returns 400 when scheduledAt is invalid date', async () => {
      const req = {
        body: {
          audience: ['a'],
          title: 'Hi',
          content: 'Hello',
          scheduledAt: 'not-a-date',
        },
      };
      const res = createResponse();
      await sendMessage(req as any, res as any, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Validation error',
        message: 'scheduledAt must be a valid date',
      });
    });

    it('returns 201 with created message for valid payload', async () => {
      const req = {
        body: {
          audience: ['user@example.com'],
          title: 'Welcome',
          content: 'Welcome message',
          scheduledAt: '2026-03-01T12:00:00.000Z',
        },
      };
      const res = createResponse();
      const created = {
        id: '65f9f9e4c51058f58d05d9aa',
        title: 'Welcome',
        content: 'Welcome message',
        audience: ['user@example.com'],
        status: 'pending',
        scheduledAt: new Date('2026-03-01T12:00:00.000Z'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      messageCenterService.createMessage.mockResolvedValue(created);

      await sendMessage(req as any, res as any, jest.fn());

      expect(messageCenterService.createMessage).toHaveBeenCalledWith({
        audience: ['user@example.com'],
        title: 'Welcome',
        content: 'Welcome message',
        scheduledAt: '2026-03-01T12:00:00.000Z',
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(created);
    });

    it('returns 201 when scheduledAt is omitted', async () => {
      const req = {
        body: { audience: ['a'], title: 'Hi', content: 'Content' },
      };
      const res = createResponse();
      messageCenterService.createMessage.mockResolvedValue({ id: '1' });

      await sendMessage(req as any, res as any, jest.fn());

      expect(messageCenterService.createMessage).toHaveBeenCalledWith({
        audience: ['a'],
        title: 'Hi',
        content: 'Content',
      });
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('returns 500 when createMessage throws', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const req = {
        body: { audience: ['a'], title: 'Hi', content: 'Content' },
      };
      const res = createResponse();
      messageCenterService.createMessage.mockRejectedValue(
        new Error('Database error'),
      );

      await sendMessage(req as any, res as any, jest.fn());

      consoleSpy.mockRestore();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal server error',
        message: 'Database error',
      });
    });
  });

  it('returns 400 for invalid page on past messages endpoint', async () => {
    const req = {
      query: {
        page: '0',
      },
    };
    const res = createResponse();

    await getPastMessages(req as any, res as any, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid page number',
      message: 'Page must be a positive integer',
    });
    expect(messageCenterService.getPastMessages).not.toHaveBeenCalled();
  });

  it('returns paginated past messages for valid request', async () => {
    const req = {
      query: {
        page: '2',
      },
    };
    const res = createResponse();

    const serviceResult = {
      page: 2,
      limit: 5,
      total: 0,
      totalPages: 0,
      messages: [],
    };

    messageCenterService.getPastMessages.mockResolvedValue(serviceResult);

    await getPastMessages(req as any, res as any, jest.fn());

    expect(messageCenterService.getPastMessages).toHaveBeenCalledWith(2);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });

  it('returns default page 1 for scheduled messages when query is missing', async () => {
    const req = {
      query: {},
    };
    const res = createResponse();

    const serviceResult = {
      page: 1,
      limit: 5,
      total: 0,
      totalPages: 0,
      messages: [],
    };

    messageCenterService.getScheduledMessages.mockResolvedValue(serviceResult);

    await getScheduledMessages(req as any, res as any, jest.fn());

    expect(messageCenterService.getScheduledMessages).toHaveBeenCalledWith(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });

  it('returns 500 when scheduled messages service throws', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const req = {
      query: {
        page: '1',
      },
    };
    const res = createResponse();

    messageCenterService.getScheduledMessages.mockRejectedValue(
      new Error('db down'),
    );

    await getScheduledMessages(req as any, res as any, jest.fn());

    consoleSpy.mockRestore();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Internal server error',
      message: 'db down',
    });
  });

  describe('editMessage', () => {
    const validMessageId = '65f9f9e4c51058f58d05d9aa';

    it('returns 400 for invalid message ID format', async () => {
      const req = {
        params: { messageId: 'invalid' },
        body: { title: 'New title' },
      };
      const res = createResponse();

      await editMessage(req as any, res as any, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid message ID',
        message: 'Message ID must be a valid 24-character hex string',
      });
      expect(messageCenterService.updateMessage).not.toHaveBeenCalled();
    });

    it('returns 400 for empty payload', async () => {
      const req = {
        params: { messageId: validMessageId },
        body: {},
      };
      const res = createResponse();

      await editMessage(req as any, res as any, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid payload',
        message:
          'At least one of title, content, or scheduledAt must be provided',
      });
      expect(messageCenterService.updateMessage).not.toHaveBeenCalled();
    });

    it('returns 400 for empty title', async () => {
      const req = {
        params: { messageId: validMessageId },
        body: { title: '   ' },
      };
      const res = createResponse();

      await editMessage(req as any, res as any, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid title',
        message: 'Title must be a non-empty string',
      });
      expect(messageCenterService.updateMessage).not.toHaveBeenCalled();
    });

    it('returns 400 for invalid scheduledAt format', async () => {
      const req = {
        params: { messageId: validMessageId },
        body: { scheduledAt: 'not-a-date' },
      };
      const res = createResponse();

      await editMessage(req as any, res as any, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid scheduledAt',
        message: 'scheduledAt must be a valid ISO date string',
      });
      expect(messageCenterService.updateMessage).not.toHaveBeenCalled();
    });

    it('returns 404 when message not found', async () => {
      const req = {
        params: { messageId: validMessageId },
        body: { title: 'New title' },
      };
      const res = createResponse();

      messageCenterService.updateMessage.mockResolvedValue(null);

      await editMessage(req as any, res as any, jest.fn());

      expect(messageCenterService.updateMessage).toHaveBeenCalledWith(
        validMessageId,
        { title: 'New title' },
      );
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Not found',
        message: 'Message not found',
      });
    });

    it('returns 400 when updating scheduledAt for sent message', async () => {
      const req = {
        params: { messageId: validMessageId },
        body: { scheduledAt: '2026-03-15T14:00:00.000Z' },
      };
      const res = createResponse();

      messageCenterService.updateMessage.mockRejectedValue(
        new Error('ScheduledAtNotAllowedForSent'),
      );

      await editMessage(req as any, res as any, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid update',
        message: 'scheduledAt cannot be updated for sent messages',
      });
    });

    it('returns 200 with updated message for valid request', async () => {
      const req = {
        params: { messageId: validMessageId },
        body: { title: 'Updated title', content: 'Updated content' },
      };
      const res = createResponse();

      const updatedMessage = {
        id: validMessageId,
        title: 'Updated title',
        content: 'Updated content',
        audience: ['all'],
        status: 'pending',
        scheduledAt: new Date('2026-03-01T12:00:00.000Z'),
        createdAt: new Date('2026-01-31T12:00:00.000Z'),
        updatedAt: new Date('2026-02-25T12:00:00.000Z'),
      };

      messageCenterService.updateMessage.mockResolvedValue(updatedMessage);

      await editMessage(req as any, res as any, jest.fn());

      expect(messageCenterService.updateMessage).toHaveBeenCalledWith(
        validMessageId,
        { title: 'Updated title', content: 'Updated content' },
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(updatedMessage);
    });
  });
});
