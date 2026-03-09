import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import News from '../src/models/news';
import {
  NewsNotFoundError,
  NewsroomService,
} from '../src/services/news.service';

// ---------------------------------------------------------------------------
// Unit Tests
// ---------------------------------------------------------------------------

describe('NewsroomService', () => {
  describe('createNews', () => {
    const validPayload = {
      title: 'Breaking News Title',
      content: '<p>This is the full news content in HTML format.</p>',
      category: 'Technology',
      publishedBy: 'Jane Doe',
    };

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should create and return a news article without an image', async () => {
      const savedDoc = { _id: new mongoose.Types.ObjectId(), ...validPayload };
      jest.spyOn(News.prototype, 'save').mockResolvedValueOnce(savedDoc as any);

      const result = await NewsroomService.createNews(validPayload);

      expect(result).toMatchObject({ title: validPayload.title });
    });

    it('should set imageUrl when a direct URL is supplied', async () => {
      const imageUrl = 'https://example.com/image.png';
      let savedData: any;

      jest.spyOn(News.prototype, 'save').mockImplementationOnce(function (
        this: any,
      ) {
        savedData = this;
        return Promise.resolve(this);
      });

      await NewsroomService.createNews(validPayload, undefined, imageUrl);

      expect(savedData.imageUrl).toBe(imageUrl);
    });

    it('should propagate database errors', async () => {
      jest
        .spyOn(News.prototype, 'save')
        .mockRejectedValueOnce(new Error('DB error'));

      await expect(NewsroomService.createNews(validPayload)).rejects.toThrow(
        'DB error',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // updateNews tests
  // ---------------------------------------------------------------------------

  describe('NewsroomService.updateNews', () => {
    const validId = new mongoose.Types.ObjectId().toHexString();

    const existingDoc = {
      _id: new mongoose.Types.ObjectId(validId),
      title: 'Original Title',
      content: '<p>Original content.</p>',
      category: 'Technology',
    };

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should update and return the modified news article', async () => {
      const updatedDoc = { ...existingDoc, title: 'Updated Title' };
      jest
        .spyOn(News, 'findByIdAndUpdate')
        .mockResolvedValueOnce(updatedDoc as any);

      const mockSession = {
        withTransaction: jest.fn((fn: () => Promise<void>) => fn()),
        endSession: jest.fn(),
      };

      jest
        .spyOn(mongoose, 'startSession')
        .mockResolvedValueOnce(mockSession as any);

      const result = await NewsroomService.updateNews(validId, {
        title: 'Updated Title',
      });

      expect(result.title).toBe('Updated Title');
    });

    it('should throw NewsNotFoundError when article does not exist', async () => {
      jest.spyOn(News, 'findByIdAndUpdate').mockResolvedValueOnce(null);

      const mockSession = {
        withTransaction: jest.fn((fn: () => Promise<void>) => fn()),
        endSession: jest.fn(),
      };

      jest
        .spyOn(mongoose, 'startSession')
        .mockResolvedValueOnce(mockSession as any);

      await expect(
        NewsroomService.updateNews(validId, { title: 'Ghost Article' }),
      ).rejects.toThrow(NewsNotFoundError);
    });

    it('should propagate unexpected database errors', async () => {
      jest
        .spyOn(News, 'findByIdAndUpdate')
        .mockRejectedValueOnce(new Error('DB failure'));

      const mockSession = {
        withTransaction: jest.fn((fn: () => Promise<void>) => fn()),
        endSession: jest.fn(),
      };

      jest
        .spyOn(mongoose, 'startSession')
        .mockResolvedValueOnce(mockSession as any);

      await expect(
        NewsroomService.updateNews(validId, { title: 'Any Title' }),
      ).rejects.toThrow('DB failure');
    });
  });

  // ---------------------------------------------------------------------------
  // getAllNews
  // ---------------------------------------------------------------------------

  describe('getAllNews', () => {
    const mockNewsArticles = [
      {
        _id: new mongoose.Types.ObjectId(),
        title: 'News 1',
        content: '<p>Content 1</p>',
        category: 'Technology',
        createdAt: new Date('2025-01-01'),
      },
      {
        _id: new mongoose.Types.ObjectId(),
        title: 'News 2',
        content: '<p>Content 2</p>',
        category: 'Sports',
        createdAt: new Date('2025-01-02'),
      },
    ];

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should return paginated news articles with default parameters', async () => {
      jest.spyOn(News, 'find').mockReturnValueOnce({
        sort: jest.fn().mockReturnValueOnce({
          skip: jest.fn().mockReturnValueOnce({
            limit: jest.fn().mockReturnValueOnce({
              exec: jest
                .fn()
                .mockResolvedValueOnce(mockNewsArticles.slice(0, 2)),
            }),
          }),
        }),
      } as any);

      jest.spyOn(News, 'countDocuments').mockResolvedValueOnce(2);

      const result = await NewsroomService.getAllNews();

      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.total).toBe(2);
      expect(result.pages).toBe(1);
      expect(result.data).toHaveLength(2);
    });

    it('should filter news by category', async () => {
      jest.spyOn(News, 'find').mockReturnValueOnce({
        sort: jest.fn().mockReturnValueOnce({
          skip: jest.fn().mockReturnValueOnce({
            limit: jest.fn().mockReturnValueOnce({
              exec: jest.fn().mockResolvedValueOnce([mockNewsArticles[0]]),
            }),
          }),
        }),
      } as any);

      jest.spyOn(News, 'countDocuments').mockResolvedValueOnce(1);

      const result = await NewsroomService.getAllNews(1, 10, 'Technology');

      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it('should respect pagination limit constraints', async () => {
      jest.spyOn(News, 'find').mockReturnValueOnce({
        sort: jest.fn().mockReturnValueOnce({
          skip: jest.fn().mockReturnValueOnce({
            limit: jest.fn().mockReturnValueOnce({
              exec: jest.fn().mockResolvedValueOnce(mockNewsArticles),
            }),
          }),
        }),
      } as any);

      jest.spyOn(News, 'countDocuments').mockResolvedValueOnce(2);

      const result = await NewsroomService.getAllNews(1, 200);

      expect(result.limit).toBe(100);
    });

    it('should handle invalid page numbers', async () => {
      jest.spyOn(News, 'find').mockReturnValueOnce({
        sort: jest.fn().mockReturnValueOnce({
          skip: jest.fn().mockReturnValueOnce({
            limit: jest.fn().mockReturnValueOnce({
              exec: jest.fn().mockResolvedValueOnce([]),
            }),
          }),
        }),
      } as any);

      jest.spyOn(News, 'countDocuments').mockResolvedValueOnce(0);

      const result = await NewsroomService.getAllNews(0, 10);

      expect(result.page).toBe(1);
    });

    it('should propagate database errors', async () => {
      jest.spyOn(News, 'find').mockImplementationOnce(() => {
        throw new Error('DB connection error');
      });

      await expect(NewsroomService.getAllNews()).rejects.toThrow(
        'DB connection error',
      );
    });
  });
});
