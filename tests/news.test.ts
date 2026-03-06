import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import News from '../src/models/news';
import { NewsNotFoundError, NewsroomService } from '../src/services/news.service';

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

      // Mock session
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

});

// ---------------------------------------------------------------------------
// Integration Tests
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

describe('PATCH /news/:id', () => {
  const validId = new mongoose.Types.ObjectId().toHexString();

  const baseDoc = {
    _id: new mongoose.Types.ObjectId(validId),
    title: 'Original Title',
    content: '<p>Original content.</p>',
    category: 'Technology',
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Helper: mock session used by the service
  function mockSession() {
    const session = {
      withTransaction: jest.fn((fn: () => Promise<void>) => fn()),
      endSession: jest.fn(),
    };
    jest.spyOn(mongoose, 'startSession').mockResolvedValue(session as any);
    return session;
  }

  it('should return 200 with the updated article', async () => {
    mockSession();
    const updatedDoc = { ...baseDoc, title: 'New Title' };
    jest.spyOn(News, 'findByIdAndUpdate').mockResolvedValueOnce(updatedDoc as any);

    const res = await request(app)
      .patch(`/news/${validId}`)
      .send({ title: 'New Title' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('News article updated successfully');
    expect(res.body.data.title).toBe('New Title');
  });

  it('should return 404 when the article does not exist', async () => {
    mockSession();
    jest.spyOn(News, 'findByIdAndUpdate').mockResolvedValueOnce(null);

    const res = await request(app)
      .patch(`/news/${validId}`)
      .send({ title: 'Ghost' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });

  it('should return 400 for an invalid MongoDB ID', async () => {
    const res = await request(app)
      .patch('/news/not-a-valid-id')
      .send({ title: 'Any' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request parameter');
  });

  it('should return 400 when no fields are provided', async () => {
    const res = await request(app).patch(`/news/${validId}`).send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('should return 400 when title is too short', async () => {
    const res = await request(app)
      .patch(`/news/${validId}`)
      .send({ title: 'Hi' });

    expect(res.status).toBe(400);
    expect(res.body.messages.properties).toHaveProperty('title');
  });

  it('should return 400 when imageUrl is not a valid URL', async () => {
    const res = await request(app)
      .patch(`/news/${validId}`)
      .send({ imageUrl: 'not-a-url' });

    expect(res.status).toBe(400);
    expect(res.body.messages.properties).toHaveProperty('imageUrl');
  });

  it('should return 500 on unexpected service errors', async () => {
    mockSession();
    jest
      .spyOn(News, 'findByIdAndUpdate')
      .mockRejectedValueOnce(new Error('Unexpected DB failure'));

    const res = await request(app)
      .patch(`/news/${validId}`)
      .send({ title: 'Valid Title Here' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
    expect(res.body.message).toBe('Unexpected DB failure');
  });

  it('should allow partial updates (only category)', async () => {
    mockSession();
    const updatedDoc = { ...baseDoc, category: 'Health' };
    jest.spyOn(News, 'findByIdAndUpdate').mockResolvedValueOnce(updatedDoc as any);

    const res = await request(app)
      .patch(`/news/${validId}`)
      .send({ category: 'Health' });

    expect(res.status).toBe(200);
    expect(res.body.data.category).toBe('Health');
  });
});

