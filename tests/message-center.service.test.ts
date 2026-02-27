import mongoose from 'mongoose';
import MessageCenter from '../src/models/message-center';
import { MessageCenterService } from '../src/services/message-center.service';

jest.mock('../src/models/message-center', () => ({
  __esModule: true,
  default: {
    find: jest.fn(),
    countDocuments: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock('mongoose', () => {
  const actual = jest.requireActual<typeof import('mongoose')>('mongoose');
  return {
    ...actual,
    startSession: jest.fn(),
  };
});

describe('MessageCenterService', () => {
  const messageCenterModel = MessageCenter as unknown as {
    find: jest.Mock;
    countDocuments: jest.Mock;
    create: jest.Mock;
  };

  const mockLean = jest.fn();
  const mockLimit = jest.fn(() => ({ lean: mockLean }));
  const mockSkip = jest.fn(() => ({ limit: mockLimit }));
  const mockSort = jest.fn(() => ({ skip: mockSkip }));

  const mockEndSession = jest.fn().mockResolvedValue(undefined);
  const mockAbortTransaction = jest.fn().mockResolvedValue(undefined);
  const mockCommitTransaction = jest.fn().mockResolvedValue(undefined);
  const mockStartTransaction = jest.fn().mockResolvedValue(undefined);
  const mockSession = {
    startTransaction: mockStartTransaction,
    commitTransaction: mockCommitTransaction,
    abortTransaction: mockAbortTransaction,
    endSession: mockEndSession,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    messageCenterModel.find.mockReturnValue({ sort: mockSort });
    (mongoose.startSession as jest.Mock).mockResolvedValue(mockSession);
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

  describe('createMessage', () => {
    it('creates a message within a transaction and returns transformed response', async () => {
      const messageId = '65f9f9e4c51058f58d05d9bb';
      const createdDoc = {
        _id: { toString: () => messageId },
        title: 'Hello',
        content: 'World',
        audience: ['user@example.com'],
        status: 'pending',
        scheduledAt: new Date('2026-03-01T12:00:00.000Z'),
        createdAt: new Date('2026-02-27T10:00:00.000Z'),
        updatedAt: new Date('2026-02-27T10:00:00.000Z'),
      };
      messageCenterModel.create.mockResolvedValue([createdDoc]);

      const result = await MessageCenterService.createMessage({
        audience: ['user@example.com'],
        title: 'Hello',
        content: 'World',
        scheduledAt: '2026-03-01T12:00:00.000Z',
      });

      expect(mongoose.startSession).toHaveBeenCalled();
      expect(mockStartTransaction).toHaveBeenCalled();
      expect(messageCenterModel.create).toHaveBeenCalledWith(
        [
          {
            title: 'Hello',
            content: 'World',
            audience: ['user@example.com'],
            status: 'pending',
            scheduledAt: new Date('2026-03-01T12:00:00.000Z'),
          },
        ],
        { session: mockSession },
      );
      expect(mockCommitTransaction).toHaveBeenCalled();
      expect(mockEndSession).toHaveBeenCalled();
      expect(result).toEqual({
        id: messageId,
        title: 'Hello',
        content: 'World',
        audience: ['user@example.com'],
        status: 'pending',
        sentAt: undefined,
        scheduledAt: new Date('2026-03-01T12:00:00.000Z'),
        createdAt: new Date('2026-02-27T10:00:00.000Z'),
        updatedAt: new Date('2026-02-27T10:00:00.000Z'),
      });
    });

    it('creates message without scheduledAt when omitted', async () => {
      const messageId = '65f9f9e4c51058f58d05d9cc';
      const createdDoc = {
        _id: { toString: () => messageId },
        title: 'No schedule',
        content: 'Content',
        audience: ['a', 'b'],
        status: 'pending',
        scheduledAt: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      messageCenterModel.create.mockResolvedValue([createdDoc]);

      await MessageCenterService.createMessage({
        audience: ['a', 'b'],
        title: 'No schedule',
        content: 'Content',
      });

      expect(messageCenterModel.create).toHaveBeenCalledWith(
        [
          {
            title: 'No schedule',
            content: 'Content',
            audience: ['a', 'b'],
            status: 'pending',
            scheduledAt: undefined,
          },
        ],
        { session: mockSession },
      );
      expect(mockCommitTransaction).toHaveBeenCalled();
    });

    it('aborts transaction and rethrows when create fails', async () => {
      messageCenterModel.create.mockRejectedValue(new Error('DB error'));

      await expect(
        MessageCenterService.createMessage({
          audience: ['x'],
          title: 'T',
          content: 'C',
        }),
      ).rejects.toThrow('DB error');

      expect(mockAbortTransaction).toHaveBeenCalled();
      expect(mockCommitTransaction).not.toHaveBeenCalled();
      expect(mockEndSession).toHaveBeenCalled();
    });
  });
});
