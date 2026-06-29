import { RequestHandler } from 'express';
import { MediaService } from '../services/media.service';
import { cloudinaryService } from '../lib/cloudinary';
import Media from '../models/media';
import EventTicket from '../models/event-ticket';

async function verifyMediaOwnership(req: any, publicId: string): Promise<boolean> {
  const userId = req.user?._id || req.user?.id;
  if (!userId) return false;

  const isAdmin = (req.user as any)?.role === 'admin';
  if (isAdmin) return true;

  const mediaRecord = await Media.findOne({ publicId });
  if (mediaRecord && mediaRecord.userId.toString() === userId.toString()) {
    return true;
  }

  const eventTicket = await EventTicket.findOne({ cloudinary_public_id: publicId });
  if (eventTicket && eventTicket.organizedBy.toString() === userId.toString()) {
    return true;
  }

  return false;
}

export const uploadMedia: RequestHandler = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file provided',
        message: 'An image file is required in the "image" field',
      });
    }

    const folder = (req.query.folder as string) || undefined;

    const result = await MediaService.upload(req.file.buffer, { folder });

    const userId = req.user?._id || req.user?.id;
    if (userId) {
      try {
        await Media.findOneAndUpdate(
          { publicId: result.publicId },
          { userId: userId, publicId: result.publicId },
          { upsert: true, new: true },
        );
      } catch (e) {
        if ((e as any)?.code !== 11000) throw e;
      }
    }

    res.status(201).json({
      message: 'File uploaded successfully',
      data: result,
    });
  } catch (error) {
    console.error('Media upload error:', error);
    res.status(500).json({
      error: 'Upload failed',
      message: error instanceof Error ? error.message : 'Failed to upload file',
    });
  }
};

export const invalidateMedia: RequestHandler = async (req, res) => {
  try {
    const { publicId } = req.body;

    if (!publicId || typeof publicId !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'A valid "publicId" string is required in the request body',
      });
    }

    const authorized = await verifyMediaOwnership(req, publicId);
    if (!authorized) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You are not authorized to invalidate this media',
      });
    }

    const result = await MediaService.invalidate(publicId);

    res.status(200).json({
      message: 'CDN cache invalidated successfully',
      data: result,
    });
  } catch (error) {
    console.error('Media invalidation error:', error);
    res.status(500).json({
      error: 'Invalidation failed',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to invalidate resource',
    });
  }
};

export const destroyMedia: RequestHandler = async (req, res) => {
  try {
    const { publicId } = req.body;

    if (!publicId || typeof publicId !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'A valid "publicId" string is required in the request body',
      });
    }

    const authorized = await verifyMediaOwnership(req, publicId);
    if (!authorized) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You are not authorized to delete this media',
      });
    }

    const result = await MediaService.destroy(publicId);

    res.status(200).json({
      message: 'Resource deleted successfully',
      data: result,
    });
  } catch (error) {
    console.error('Media destroy error:', error);
    res.status(500).json({
      error: 'Deletion failed',
      message:
        error instanceof Error ? error.message : 'Failed to delete resource',
    });
  }
};

/** GET /media/signed-params — returns signed upload params for direct frontend upload to Cloudinary */
export const getSignedUploadParams: RequestHandler = async (_req, res) => {
  try {
    const params = cloudinaryService.getSignedUploadParams('events/tickets');
    res.status(200).json({
      message: 'Use these params to upload directly to Cloudinary',
      data: params,
    });
  } catch (error) {
    console.error('Signed params error:', error);
    res.status(500).json({
      error: 'Failed to generate signed params',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to generate signed params',
    });
  }
};
