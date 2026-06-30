import {
  destroyMedia,
  invalidateMedia,
  uploadMedia,
} from '../src/controllers/media.controller';
import Media from '../src/models/media';
import EventTicket from '../src/models/event-ticket';
import { MediaService } from '../src/services/media.service';

jest.mock('../src/models/media');
jest.mock('../src/models/event-ticket');
jest.mock('../src/services/media.service');

describe('media controller — IDOR protection (issue #132)', () => {
  const createResponse = () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    return res;
  };

  const createRequest = (user: any, body: any = {}, file: any = null) => ({
    user,
    body,
    file,
    query: {},
  });

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('destroyMedia', () => {
    it('returns 400 when publicId is missing', async () => {
      const req = createRequest({ _id: 'user-1', role: 'user' }, {});
      const res = createResponse();

      await destroyMedia(req as any, res as any, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid request',
        message: 'A valid "publicId" string is required in the request body',
      });
    });

    it('returns 403 when user does not own the media', async () => {
      (Media.findOne as jest.Mock).mockResolvedValue({
        publicId: 'media-123',
        userId: 'other-user-id',
      });

      const req = createRequest(
        { _id: 'user-1', role: 'user' },
        { publicId: 'media-123' },
      );
      const res = createResponse();

      await destroyMedia(req as any, res as any, jest.fn());

      expect(Media.findOne).toHaveBeenCalledWith({ publicId: 'media-123' });
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'You are not authorized to delete this media',
      });
    });

    it('returns 403 when admin is missing role (not admin)', async () => {
      (Media.findOne as jest.Mock).mockResolvedValue({
        publicId: 'media-123',
        userId: 'other-user-id',
      });

      const req = createRequest({ _id: 'user-1' }, { publicId: 'media-123' });
      const res = createResponse();

      await destroyMedia(req as any, res as any, jest.fn());

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns 403 when publicId does not exist anywhere', async () => {
      (Media.findOne as jest.Mock).mockResolvedValue(null);
      (EventTicket.findOne as jest.Mock).mockResolvedValue(null);

      const req = createRequest(
        { _id: 'user-1', role: 'user' },
        { publicId: 'nonexistent-public-id' },
      );
      const res = createResponse();

      await destroyMedia(req as any, res as any, jest.fn());

      expect(Media.findOne).toHaveBeenCalledWith({
        publicId: 'nonexistent-public-id',
      });
      expect(EventTicket.findOne).toHaveBeenCalledWith({
        cloudinary_public_id: 'nonexistent-public-id',
      });
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'You are not authorized to delete this media',
      });
    });

    it('allows admin to destroy any media', async () => {
      (MediaService.destroy as jest.Mock).mockResolvedValue({ result: 'ok' });

      const req = createRequest(
        { _id: 'admin-1', role: 'admin' },
        { publicId: 'media-123' },
      );
      const res = createResponse();

      await destroyMedia(req as any, res as any, jest.fn());

      expect(Media.findOne).not.toHaveBeenCalled();
      expect(EventTicket.findOne).not.toHaveBeenCalled();
      expect(MediaService.destroy).toHaveBeenCalledWith('media-123');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('allows user to destroy their own media', async () => {
      (Media.findOne as jest.Mock).mockResolvedValue({
        publicId: 'media-123',
        userId: 'user-1',
      });
      (MediaService.destroy as jest.Mock).mockResolvedValue({ result: 'ok' });

      const req = createRequest(
        { _id: 'user-1', role: 'user' },
        { publicId: 'media-123' },
      );
      const res = createResponse();

      await destroyMedia(req as any, res as any, jest.fn());

      expect(MediaService.destroy).toHaveBeenCalledWith('media-123');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('allows user to destroy media owned by their event ticket', async () => {
      (Media.findOne as jest.Mock).mockResolvedValue(null);
      (EventTicket.findOne as jest.Mock).mockResolvedValue({
        cloudinary_public_id: 'media-456',
        organizedBy: 'user-1',
      });
      (MediaService.destroy as jest.Mock).mockResolvedValue({ result: 'ok' });

      const req = createRequest(
        { _id: 'user-1', role: 'user' },
        { publicId: 'media-456' },
      );
      const res = createResponse();

      await destroyMedia(req as any, res as any, jest.fn());

      expect(EventTicket.findOne).toHaveBeenCalledWith({
        cloudinary_public_id: 'media-456',
      });
      expect(MediaService.destroy).toHaveBeenCalledWith('media-456');
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('invalidateMedia', () => {
    it('returns 400 when publicId is missing', async () => {
      const req = createRequest({ _id: 'user-1', role: 'user' }, {});
      const res = createResponse();

      await invalidateMedia(req as any, res as any, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 403 when user does not own the media', async () => {
      (Media.findOne as jest.Mock).mockResolvedValue({
        publicId: 'media-123',
        userId: 'other-user-id',
      });

      const req = createRequest(
        { _id: 'user-1', role: 'user' },
        { publicId: 'media-123' },
      );
      const res = createResponse();

      await invalidateMedia(req as any, res as any, jest.fn());

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'You are not authorized to invalidate this media',
      });
    });

    it('returns 403 when publicId does not exist anywhere', async () => {
      (Media.findOne as jest.Mock).mockResolvedValue(null);
      (EventTicket.findOne as jest.Mock).mockResolvedValue(null);

      const req = createRequest(
        { _id: 'user-1', role: 'user' },
        { publicId: 'nonexistent-public-id' },
      );
      const res = createResponse();

      await invalidateMedia(req as any, res as any, jest.fn());

      expect(Media.findOne).toHaveBeenCalledWith({
        publicId: 'nonexistent-public-id',
      });
      expect(EventTicket.findOne).toHaveBeenCalledWith({
        cloudinary_public_id: 'nonexistent-public-id',
      });
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'You are not authorized to invalidate this media',
      });
    });

    it('allows admin to invalidate any media', async () => {
      (MediaService.invalidate as jest.Mock).mockResolvedValue({
        publicId: 'media-123',
        url: 'https://example.com/image.jpg',
      });

      const req = createRequest(
        { _id: 'admin-1', role: 'admin' },
        { publicId: 'media-123' },
      );
      const res = createResponse();

      await invalidateMedia(req as any, res as any, jest.fn());

      expect(MediaService.invalidate).toHaveBeenCalledWith('media-123');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('allows user to invalidate their own media', async () => {
      (Media.findOne as jest.Mock).mockResolvedValue({
        publicId: 'media-123',
        userId: 'user-1',
      });
      (MediaService.invalidate as jest.Mock).mockResolvedValue({
        publicId: 'media-123',
        url: 'https://example.com/image.jpg',
      });

      const req = createRequest(
        { _id: 'user-1', role: 'user' },
        { publicId: 'media-123' },
      );
      const res = createResponse();

      await invalidateMedia(req as any, res as any, jest.fn());

      expect(MediaService.invalidate).toHaveBeenCalledWith('media-123');
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('uploadMedia', () => {
    it('returns 400 when no file provided', async () => {
      const req = createRequest({ _id: 'user-1', role: 'user' }, {}, null);
      const res = createResponse();

      await uploadMedia(req as any, res as any, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'No file provided',
        message: 'An image file is required in the "image" field',
      });
    });

    it('calls Media.findOneAndUpdate with publicId and userId after successful upload', async () => {
      const mockFile = { buffer: Buffer.from('test-image') };
      const mockUploadResult = {
        publicId: 'uploaded-public-id',
        url: 'https://example.com/image.jpg',
      };

      (MediaService.upload as jest.Mock).mockResolvedValue(mockUploadResult);
      (Media.findOneAndUpdate as jest.Mock).mockResolvedValue({
        publicId: 'uploaded-public-id',
        userId: 'user-1',
      });

      const req = createRequest({ _id: 'user-1', role: 'user' }, {}, mockFile);
      const res = createResponse();

      await uploadMedia(req as any, res as any, jest.fn());

      expect(MediaService.upload).toHaveBeenCalledWith(mockFile.buffer, {
        folder: undefined,
      });
      expect(Media.findOneAndUpdate).toHaveBeenCalledWith(
        { publicId: mockUploadResult.publicId },
        { userId: 'user-1', publicId: mockUploadResult.publicId },
        { upsert: true, new: true },
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });
});
