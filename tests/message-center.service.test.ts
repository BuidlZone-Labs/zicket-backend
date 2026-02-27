import MessageCenter from '../src/models/message-center';
import { MessageCenterService } from '../src/services/message-center.service';

jest.mock('../src/models/message-center', () => ({
  __esModule: true,
  default: {
    find: jest.fn(),
    countDocuments: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));

describe('MessageCenterService', () => {
  const messageCenterModel = MessageCenter as unknown as {
    find: jest.Mock;
    countDocuments: jest.Mock;
    findById: jest.Mock;
    findByIdAndUpdate: jest.Mock;
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

  describe('updateMessage', () => {
    const messageId = '65f9f9e4c51058f58d05d9aa';
    const mockFindByIdLean = jest.fn();
    const mockFindByIdAndUpdateLean = jest.fn();

    beforeEach(() => {
      jest.clearAllMocks();
      messageCenterModel.findById.mockReturnValue({ lean: mockFindByIdLean });
      messageCenterModel.findByIdAndUpdate.mockReturnValue({
        lean: mockFindByIdAndUpdateLean,
      });
    });

    it('returns null when message not found', async () => {
      mockFindByIdLean.mockResolvedValue(null);

      const result = await MessageCenterService.updateMessage(messageId, {
        title: 'Updated',
      });

      expect(messageCenterModel.findById).toHaveBeenCalledWith(messageId);
      expect(result).toBeNull();
      expect(messageCenterModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('updates title and content for pending message', async () => {
      const existingMessage = {
        _id: { toString: () => messageId },
        title: 'Old',
        content: 'Old content',
        audience: ['all'],
        status: 'pending',
        scheduledAt: new Date('2026-03-01T12:00:00.000Z'),
        createdAt: new Date('2026-01-31T12:00:00.000Z'),
        updatedAt: new Date('2026-01-31T12:00:00.000Z'),
      };
      const updatedMessage = {
        ...existingMessage,
        title: 'New',
        content: 'New content',
        updatedAt: new Date('2026-02-25T12:00:00.000Z'),
      };

      mockFindByIdLean.mockResolvedValue(existingMessage);
      mockFindByIdAndUpdateLean.mockResolvedValue(updatedMessage);

      const result = await MessageCenterService.updateMessage(messageId, {
        title: 'New',
        content: 'New content',
      });

      expect(messageCenterModel.findByIdAndUpdate).toHaveBeenCalledWith(
        messageId,
        { $set: { title: 'New', content: 'New content' } },
        { new: true },
      );
      expect(result).toEqual({
        id: messageId,
        title: 'New',
        content: 'New content',
        audience: ['all'],
        status: 'pending',
        sentAt: undefined,
        scheduledAt: new Date('2026-03-01T12:00:00.000Z'),
        createdAt: new Date('2026-01-31T12:00:00.000Z'),
        updatedAt: new Date('2026-02-25T12:00:00.000Z'),
      });
    });

    it('updates scheduledAt for pending message', async () => {
      const existingMessage = {
        _id: { toString: () => messageId },
        title: 'Title',
        content: 'Content',
        audience: ['all'],
        status: 'pending',
        scheduledAt: new Date('2026-03-01T12:00:00.000Z'),
        createdAt: new Date('2026-01-31T12:00:00.000Z'),
        updatedAt: new Date('2026-01-31T12:00:00.000Z'),
      };
      const newScheduledAt = new Date('2026-03-15T14:00:00.000Z');
      const updatedMessage = {
        ...existingMessage,
        scheduledAt: newScheduledAt,
      };

      mockFindByIdLean.mockResolvedValue(existingMessage);
      mockFindByIdAndUpdateLean.mockResolvedValue(updatedMessage);

      await MessageCenterService.updateMessage(messageId, {
        scheduledAt: newScheduledAt,
      });

      expect(messageCenterModel.findByIdAndUpdate).toHaveBeenCalledWith(
        messageId,
        { $set: { scheduledAt: newScheduledAt } },
        { new: true },
      );
    });

    it('throws when updating scheduledAt for sent message', async () => {
      const sentMessage = {
        _id: { toString: () => messageId },
        title: 'Title',
        content: 'Content',
        audience: ['all'],
        status: 'sent',
        sentAt: new Date('2026-02-01T12:00:00.000Z'),
        createdAt: new Date('2026-01-31T12:00:00.000Z'),
        updatedAt: new Date('2026-02-01T12:00:00.000Z'),
      };

      mockFindByIdLean.mockResolvedValue(sentMessage);

      await expect(
        MessageCenterService.updateMessage(messageId, {
          scheduledAt: new Date('2026-03-15T14:00:00.000Z'),
        }),
      ).rejects.toThrow('ScheduledAtNotAllowedForSent');

      expect(messageCenterModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('returns message unchanged when payload has no updatable fields', async () => {
      const existingMessage = {
        _id: { toString: () => messageId },
        title: 'Title',
        content: 'Content',
        audience: ['all'],
        status: 'pending',
        createdAt: new Date('2026-01-31T12:00:00.000Z'),
        updatedAt: new Date('2026-01-31T12:00:00.000Z'),
      };

      mockFindByIdLean.mockResolvedValue(existingMessage);

      const result = await MessageCenterService.updateMessage(messageId, {});

      expect(messageCenterModel.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(result).toEqual({
        id: messageId,
        title: 'Title',
        content: 'Content',
        audience: ['all'],
        status: 'pending',
        sentAt: undefined,
        scheduledAt: undefined,
        createdAt: new Date('2026-01-31T12:00:00.000Z'),
        updatedAt: new Date('2026-01-31T12:00:00.000Z'),
      });
    });
  });
});
