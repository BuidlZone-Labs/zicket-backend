import mongoose from 'mongoose';
import News from '../src/models/news';
import { NewsService } from '../src/services/news.service';

jest.mock('../src/models/news', () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
  },
}));

jest.mock('mongoose', () => {
  const actual = jest.requireActual<typeof import('mongoose')>('mongoose');
  return {
    ...actual,
    startSession: jest.fn(),
  };
});

describe('NewsService', () => {
  const newsModel = News as unknown as {
    findById: jest.Mock;
    findByIdAndUpdate: jest.Mock;
    findByIdAndDelete: jest.Mock;
  };

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
    (mongoose.startSession as jest.Mock).mockResolvedValue(mockSession);
  });

  describe('deleteNewsById', () => {
    it('soft deletes a news article successfully', async () => {
      const newsId = '65f9f9e4c51058f58d05d9aa';
      const mockNews = {
        _id: { toString: () => newsId },
        title: 'Test News',
        content: 'Test Content',
        isDeleted: false,
      };

      newsModel.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockNews),
      });
      newsModel.findByIdAndUpdate.mockReturnValue({
        session: jest.fn().mockResolvedValue({
          ...mockNews,
          isDeleted: true,
          deletedAt: new Date(),
        }),
      });

      const result = await NewsService.deleteNewsById(newsId);

      expect(mongoose.startSession).toHaveBeenCalled();
      expect(mockStartTransaction).toHaveBeenCalled();
      expect(newsModel.findById).toHaveBeenCalledWith(newsId);
      expect(newsModel.findByIdAndUpdate).toHaveBeenCalledWith(
        newsId,
        {
          isDeleted: true,
          deletedAt: expect.any(Date),
        },
        { new: true, session: mockSession },
      );
      expect(mockCommitTransaction).toHaveBeenCalled();
      expect(mockEndSession).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.newsId).toBe(newsId);
      expect(result.deletedAt).toBeDefined();
    });

    it('throws error for invalid ID format', async () => {
      const invalidId = 'invalid-id';

      await expect(NewsService.deleteNewsById(invalidId)).rejects.toThrow(
        'Invalid news ID format',
      );

      expect(mockStartTransaction).not.toHaveBeenCalled();
    });

    it('throws error when news article not found', async () => {
      const newsId = '65f9f9e4c51058f58d05d9aa';

      newsModel.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue(null),
      });

      await expect(NewsService.deleteNewsById(newsId)).rejects.toThrow(
        'News article not found',
      );

      expect(mockAbortTransaction).toHaveBeenCalled();
      expect(mockEndSession).toHaveBeenCalled();
    });

    it('throws error when news already deleted', async () => {
      const newsId = '65f9f9e4c51058f58d05d9aa';
      const mockNews = {
        _id: { toString: () => newsId },
        title: 'Test News',
        isDeleted: true,
      };

      newsModel.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockNews),
      });

      await expect(NewsService.deleteNewsById(newsId)).rejects.toThrow(
        'News article has already been deleted',
      );

      expect(mockAbortTransaction).toHaveBeenCalled();
      expect(mockEndSession).toHaveBeenCalled();
    });

    it('aborts transaction on error', async () => {
      const newsId = '65f9f9e4c51058f58d05d9aa';
      const mockNews = {
        _id: { toString: () => newsId },
        title: 'Test News',
        isDeleted: false,
      };

      newsModel.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockNews),
      });
      newsModel.findByIdAndUpdate.mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(NewsService.deleteNewsById(newsId)).rejects.toThrow();

      expect(mockAbortTransaction).toHaveBeenCalled();
      expect(mockCommitTransaction).not.toHaveBeenCalled();
      expect(mockEndSession).toHaveBeenCalled();
    });
  });

  describe('hardDeleteNewsById', () => {
    it('hard deletes a soft-deleted news article', async () => {
      const newsId = '65f9f9e4c51058f58d05d9aa';
      const mockNews = {
        _id: { toString: () => newsId },
        title: 'Test News',
        isDeleted: true,
        deletedAt: new Date(),
      };

      newsModel.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockNews),
      });
      newsModel.findByIdAndDelete.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockNews),
      });

      const result = await NewsService.hardDeleteNewsById(newsId);

      expect(mongoose.startSession).toHaveBeenCalled();
      expect(mockStartTransaction).toHaveBeenCalled();
      expect(newsModel.findById).toHaveBeenCalledWith(newsId);
      expect(newsModel.findByIdAndDelete).toHaveBeenCalledWith(newsId);
      expect(
        newsModel.findByIdAndDelete.mock.results[0].value.session,
      ).toHaveBeenCalledWith(mockSession);
      expect(mockCommitTransaction).toHaveBeenCalled();
      expect(mockEndSession).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.newsId).toBe(newsId);
    });

    it('requires soft delete before hard delete', async () => {
      const newsId = '65f9f9e4c51058f58d05d9aa';
      const mockNews = {
        _id: { toString: () => newsId },
        title: 'Test News',
        isDeleted: false,
      };

      newsModel.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockNews),
      });

      await expect(NewsService.hardDeleteNewsById(newsId)).rejects.toThrow(
        'must be soft deleted before hard deletion',
      );

      expect(mockAbortTransaction).toHaveBeenCalled();
      expect(mockEndSession).toHaveBeenCalled();
    });

    it('allows force hard delete without soft delete', async () => {
      const newsId = '65f9f9e4c51058f58d05d9aa';
      const mockNews = {
        _id: { toString: () => newsId },
        title: 'Test News',
        isDeleted: false,
      };

      newsModel.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockNews),
      });
      newsModel.findByIdAndDelete.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockNews),
      });

      const result = await NewsService.hardDeleteNewsById(newsId, true);

      expect(result.success).toBe(true);
      expect(mockCommitTransaction).toHaveBeenCalled();
    });
  });

  describe('restoreNewsById', () => {
    it('restores a soft-deleted news article', async () => {
      const newsId = '65f9f9e4c51058f58d05d9aa';
      const mockNews = {
        _id: { toString: () => newsId },
        title: 'Test News',
        isDeleted: true,
        deletedAt: new Date(),
      };

      newsModel.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockNews),
      });
      newsModel.findByIdAndUpdate.mockReturnValue({
        session: jest.fn().mockResolvedValue({
          ...mockNews,
          isDeleted: false,
          deletedAt: undefined,
        }),
      });

      const result = await NewsService.restoreNewsById(newsId);

      expect(mongoose.startSession).toHaveBeenCalled();
      expect(mockStartTransaction).toHaveBeenCalled();
      expect(newsModel.findById).toHaveBeenCalledWith(newsId);
      expect(newsModel.findByIdAndUpdate).toHaveBeenCalledWith(
        newsId,
        {
          isDeleted: false,
          deletedAt: undefined,
        },
        { new: true, session: mockSession },
      );
      expect(mockCommitTransaction).toHaveBeenCalled();
      expect(mockEndSession).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.newsId).toBe(newsId);
    });

    it('throws error when news is not deleted', async () => {
      const newsId = '65f9f9e4c51058f58d05d9aa';
      const mockNews = {
        _id: { toString: () => newsId },
        title: 'Test News',
        isDeleted: false,
      };

      newsModel.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockNews),
      });

      await expect(NewsService.restoreNewsById(newsId)).rejects.toThrow(
        'News article is not deleted',
      );

      expect(mockAbortTransaction).toHaveBeenCalled();
      expect(mockEndSession).toHaveBeenCalled();
    });
  });
});
