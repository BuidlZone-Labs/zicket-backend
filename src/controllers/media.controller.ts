import { RequestHandler } from 'express';
import { MediaService } from '../services/media.service';
import { cloudinaryService } from '../lib/cloudinary';

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
