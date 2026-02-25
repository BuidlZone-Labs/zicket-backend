import MessageCenter from '../src/models/message-center';
import { MessageCenterService } from '../src/services/message-center.service';

jest.mock('../src/models/message-center', () => ({
  __esModule: true,
  default: {
    find: jest.fn(),
    countDocuments: jest.fn(),
  },
}));

describe('MessageCenterService', () => {
  const messageCenterModel = MessageCenter as unknown as {
    find: jest.Mock;
    countDocuments: jest.Mock;
  };

  const mockLean = jest.fn();
  const mockLimit = jest.fn(() => ({ lean: mockLean }));
  const mockSkip = jest.fn(() => ({ limit: mockLimit }));
  const mockSort = jest.fn(() => ({ skip: mockSkip }));

  beforeEach(() => {
    jest.clearAllMocks();
    messageCenterModel.find.mockReturnValue({ sort: mockSort });
  });

  it('returns paginated past messages with fixed limit of 5', async () => {
    const messageId = '65f9f9e4c51058f58d05d9aa';

    mockLean.mockResolvedValue([
      {
        _id: {
          toString: () => messageId,
        },
        title: 'Sent message',
        content: 'content',
        audience: ['all'],
        status: 'sent',
        sentAt: new Date('2026-02-01T12:00:00.000Z'),
        createdAt: new Date('2026-01-31T12:00:00.000Z'),
        updatedAt: new Date('2026-02-01T12:00:00.000Z'),
      },
    ]);
    messageCenterModel.countDocuments.mockResolvedValue(6);

    const result = await MessageCenterService.getPastMessages(2);

    expect(messageCenterModel.find).toHaveBeenCalledWith({
      $or: [{ status: 'sent' }, { sentAt: { $lte: expect.any(Date) } }],
    });
    expect(mockSort).toHaveBeenCalledWith({ sentAt: -1, createdAt: -1 });
    expect(mockSkip).toHaveBeenCalledWith(5);
    expect(mockLimit).toHaveBeenCalledWith(5);
    expect(messageCenterModel.countDocuments).toHaveBeenCalledWith({
      $or: [{ status: 'sent' }, { sentAt: { $lte: expect.any(Date) } }],
    });

    expect(result).toEqual({
      page: 2,
      limit: 5,
      total: 6,
      totalPages: 2,
      messages: [
        {
          id: messageId,
          title: 'Sent message',
          content: 'content',
          audience: ['all'],
          status: 'sent',
          sentAt: new Date('2026-02-01T12:00:00.000Z'),
          scheduledAt: undefined,
          createdAt: new Date('2026-01-31T12:00:00.000Z'),
          updatedAt: new Date('2026-02-01T12:00:00.000Z'),
        },
      ],
    });
  });

  it('returns scheduled messages sorted by scheduled date ascending', async () => {
    mockLean.mockResolvedValue([]);
    messageCenterModel.countDocuments.mockResolvedValue(0);

    await MessageCenterService.getScheduledMessages(1);

    expect(messageCenterModel.find).toHaveBeenCalledWith({
      status: 'pending',
      scheduledAt: { $gt: expect.any(Date) },
    });
    expect(mockSort).toHaveBeenCalledWith({ scheduledAt: 1, createdAt: 1 });
    expect(mockSkip).toHaveBeenCalledWith(0);
    expect(mockLimit).toHaveBeenCalledWith(5);
  });
});
