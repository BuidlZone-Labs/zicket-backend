import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import News from '../src/models/news';
import { NewsroomService } from '../src/services/news.service';

// ---------------------------------------------------------------------------
// Unit Tests: NewsroomService
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
              exec: jest
                .fn()
                .mockResolvedValueOnce([mockNewsArticles[0]]),
            }),
          }),
        }),
      } as any);

      jest.spyOn(News, 'countDocuments').mockResolvedValueOnce(1);

      const result = await NewsroomService.getAllNews(
        1,
        10,
        'Technology',
      );

      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it('should respect pagination limit constraints', async () => {
      jest.spyOn(News, 'find').mockReturnValueOnce({
        sort: jest.fn().mockReturnValueOnce({
          skip: jest.fn().mockReturnValueOnce({
            limit: jest.fn().mockReturnValueOnce({
              exec: jest
                .fn()
                .mockResolvedValueOnce(mockNewsArticles),
            }),
          }),
        }),
      } as any);

      jest.spyOn(News, 'countDocuments').mockResolvedValueOnce(2);

      // Test with limit > 100 (should be capped at 100)
      const result = await NewsroomService.getAllNews(1, 200);

      expect(result.limit).toBe(100);
    });

    it('should handle invalid page numbers', async () => {
      jest.spyOn(News, 'find').mockReturnValueOnce({
        sort: jest.fn().mockReturnValueOnce({
          skip: jest.fn().mockReturnValueOnce({
            limit: jest.fn().mockReturnValueOnce({
              exec: jest
                .fn()
                .mockResolvedValueOnce([]),
            }),
          }),
        }),
      } as any);

      jest.spyOn(News, 'countDocuments').mockResolvedValueOnce(0);

      // Test with page < 1 (should be set to 1)
      const result = await NewsroomService.getAllNews(0, 10);

      expect(result.page).toBe(1);
    });

    it('should propagate database errors', async () => {
      jest
        .spyOn(News, 'find')
        .mockImplementationOnce(() => {
          throw new Error('DB connection error');
        });

      await expect(NewsroomService.getAllNews()).rejects.toThrow(
        'DB connection error',
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Integration Tests: POST /news
// ---------------------------------------------------------------------------

describe('POST /news', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const validBody = {
    title: 'A Valid News Title',
    content: '<p>Detailed content goes here for the article.</p>',
    category: 'Sports',
  };

  it('should return 201 with the created news article', async () => {
    const savedDoc = { _id: new mongoose.Types.ObjectId(), ...validBody };
    jest.spyOn(News.prototype, 'save').mockResolvedValueOnce(savedDoc as any);

    const res = await request(app).post('/news').send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('News article created successfully');
    expect(res.body.data).toMatchObject({ title: validBody.title });
  });

  it('should return 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/news')
      .send({ title: 'No content or category' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    // Fix: Check the nested structure
    expect(res.body.messages.properties).toHaveProperty('content');
    expect(res.body.messages.properties).toHaveProperty('category');
  });

  it('should return 400 when title is too short', async () => {
    const res = await request(app)
      .post('/news')
      .send({ ...validBody, title: 'Ab' });

    expect(res.status).toBe(400);
    // Fix: Check the nested structure
    expect(res.body.messages.properties).toHaveProperty('title');
  });

  it('should return 400 when publishAvatarUrl is not a valid URL', async () => {
    const res = await request(app)
      .post('/news')
      .send({ ...validBody, publishAvatarUrl: 'not-a-url' });

    expect(res.status).toBe(400);
    // Fix: Check the nested structure
    expect(res.body.messages.properties).toHaveProperty('publishAvatarUrl');
  });

  it('should accept an optional imageUrl string', async () => {
    const savedDoc = {
      _id: new mongoose.Types.ObjectId(),
      ...validBody,
      imageUrl: 'https://cdn.example.com/img.jpg',
    };
    jest.spyOn(News.prototype, 'save').mockResolvedValueOnce(savedDoc as any);

    const res = await request(app)
      .post('/news')
      .send({ ...validBody, imageUrl: 'https://cdn.example.com/img.jpg' });

    expect(res.status).toBe(201);
    expect(res.body.data.imageUrl).toBe('https://cdn.example.com/img.jpg');
  });

  it('should return 500 on unexpected service errors', async () => {
    jest
      .spyOn(News.prototype, 'save')
      .mockRejectedValueOnce(new Error('Unexpected DB failure'));

    const res = await request(app).post('/news').send(validBody);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
    expect(res.body.message).toBe('Unexpected DB failure');
  });
});

// ---------------------------------------------------------------------------
// Integration Tests: GET /news
// ---------------------------------------------------------------------------

describe('GET /news', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockNewsData = [
    {
      _id: new mongoose.Types.ObjectId(),
      title: 'Tech News 1',
      content: '<p>Content about technology</p>',
      category: 'Technology',
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
    },
    {
      _id: new mongoose.Types.ObjectId(),
      title: 'Sports News 1',
      content: '<p>Content about sports</p>',
      category: 'Sports',
      createdAt: new Date('2025-01-02'),
      updatedAt: new Date('2025-01-02'),
    },
  ];

  it('should return paginated news articles with default parameters', async () => {
    jest.spyOn(News, 'find').mockReturnValueOnce({
      sort: jest.fn().mockReturnValueOnce({
        skip: jest.fn().mockReturnValueOnce({
          limit: jest.fn().mockReturnValueOnce({
            exec: jest
              .fn()
              .mockResolvedValueOnce(mockNewsData),
          }),
        }),
      }),
    } as any);

    jest.spyOn(News, 'countDocuments').mockResolvedValueOnce(2);

    const res = await request(app).get('/news');

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('News articles retrieved successfully');
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination).toEqual({
      total: 2,
      page: 1,
      limit: 10,
      pages: 1,
    });
  });

  it('should accept custom page and limit parameters', async () => {
    jest.spyOn(News, 'find').mockReturnValueOnce({
      sort: jest.fn().mockReturnValueOnce({
        skip: jest.fn().mockReturnValueOnce({
          limit: jest.fn().mockReturnValueOnce({
            exec: jest
              .fn()
              .mockResolvedValueOnce([mockNewsData[0]]),
          }),
        }),
      }),
    } as any);

    jest.spyOn(News, 'countDocuments').mockResolvedValueOnce(5);

    const res = await request(app)
      .get('/news')
      .query({ page: 2, limit: 5 });

    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(2);
    expect(res.body.pagination.limit).toBe(5);
    expect(res.body.pagination.pages).toBe(1);
  });

  it('should filter news by category', async () => {
    jest.spyOn(News, 'find').mockReturnValueOnce({
      sort: jest.fn().mockReturnValueOnce({
        skip: jest.fn().mockReturnValueOnce({
          limit: jest.fn().mockReturnValueOnce({
            exec: jest
              .fn()
              .mockResolvedValueOnce([mockNewsData[0]]),
          }),
        }),
      }),
    } as any);

    jest.spyOn(News, 'countDocuments').mockResolvedValueOnce(1);

    const res = await request(app)
      .get('/news')
      .query({ category: 'Technology' });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
  });

  it('should return 400 with invalid page parameter', async () => {
    const res = await request(app)
      .get('/news')
      .query({ page: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid pagination');
    expect(res.body.message).toBe('Page must be at least 1');
  });

  it('should return 400 with invalid limit parameter', async () => {
    const res = await request(app)
      .get('/news')
      .query({ limit: 101 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid pagination');
    expect(res.body.message).toBe('Limit must be between 1 and 100');
  });

  it('should return 400 with invalid sort order', async () => {
    const res = await request(app)
      .get('/news')
      .query({ sortOrder: 'invalid' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid sort order');
    expect(res.body.message).toBe('sortOrder must be "asc" or "desc"');
  });

  it('should support custom sorting', async () => {
    jest.spyOn(News, 'find').mockReturnValueOnce({
      sort: jest.fn().mockReturnValueOnce({
        skip: jest.fn().mockReturnValueOnce({
          limit: jest.fn().mockReturnValueOnce({
            exec: jest
              .fn()
              .mockResolvedValueOnce([mockNewsData[1], mockNewsData[0]]),
          }),
        }),
      }),
    } as any);

    jest.spyOn(News, 'countDocuments').mockResolvedValueOnce(2);

    const res = await request(app)
      .get('/news')
      .query({ sortBy: 'title', sortOrder: 'asc' });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('should return 500 on unexpected service errors', async () => {
    jest
      .spyOn(News, 'find')
      .mockImplementationOnce(() => {
        throw new Error('Unexpected database error');
      });

    const res = await request(app).get('/news');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
    expect(res.body.message).toBe('Unexpected database error');
  });
});
