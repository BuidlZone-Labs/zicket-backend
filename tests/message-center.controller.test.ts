import {
  getPastMessages,
  getScheduledMessages,
} from '../src/controllers/message-center.controller';
import { MessageCenterService } from '../src/services/message-center.service';

jest.mock('../src/services/message-center.service', () => ({
  MessageCenterService: {
    getPastMessages: jest.fn(),
    getScheduledMessages: jest.fn(),
  },
}));

describe('message-center controller', () => {
  const messageCenterService = MessageCenterService as unknown as {
    getPastMessages: jest.Mock;
    getScheduledMessages: jest.Mock;
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

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Internal server error',
      message: 'db down',
    });
  });
});
