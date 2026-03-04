import { incrementReadCount } from '../src/controllers/news.controller';
import { NewsService } from '../src/services/news.service';

jest.mock('../src/services/news.service', () => ({
  NewsService: {
    incrementReadCount: jest.fn(),
  },
}));

describe('news controller', () => {
  const newsService = NewsService as unknown as {
    incrementReadCount: jest.Mock;
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

  describe('incrementReadCount', () => {
    const validNewsId = '65f9f9e4c51058f58d05d9aa';

    it('returns 400 for invalid news ID format', async () => {
      const req = {
        params: { id: 'invalid' },
      };
      const res = createResponse();

      await incrementReadCount(req as any, res as any, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid news ID',
        message: 'News ID must be a valid 24-character hex string',
      });
      expect(newsService.incrementReadCount).not.toHaveBeenCalled();
    });

    it('returns 400 for missing news ID', async () => {
      const req = {
        params: {},
      };
      const res = createResponse();

      await incrementReadCount(req as any, res as any, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid news ID',
        message: 'News ID must be a valid 24-character hex string',
      });
      expect(newsService.incrementReadCount).not.toHaveBeenCalled();
    });

    it('returns 404 when news not found', async () => {
      const req = {
        params: { id: validNewsId },
      };
      const res = createResponse();

      newsService.incrementReadCount.mockResolvedValue(null);

      await incrementReadCount(req as any, res as any, jest.fn());

      expect(newsService.incrementReadCount).toHaveBeenCalledWith(validNewsId);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Not found',
        message: 'News not found',
      });
    });

    it('returns 200 with updated news for valid request', async () => {
      const req = {
        params: { id: validNewsId },
      };
      const res = createResponse();

      const updatedNews = {
        id: validNewsId,
        title: 'Breaking News',
        content: 'News content',
        category: 'Technology',
        readCount: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      newsService.incrementReadCount.mockResolvedValue(updatedNews);

      await incrementReadCount(req as any, res as any, jest.fn());

      expect(newsService.incrementReadCount).toHaveBeenCalledWith(validNewsId);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(updatedNews);
    });

    it('returns 500 when service throws error', async () => {
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const req = {
        params: { id: validNewsId },
      };
      const res = createResponse();

      newsService.incrementReadCount.mockRejectedValue(
        new Error('Database error'),
      );

      await incrementReadCount(req as any, res as any, jest.fn());

      consoleSpy.mockRestore();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal server error',
        message: 'Database error',
      });
    });
  });
});
