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
