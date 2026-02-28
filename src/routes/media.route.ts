import { Router } from 'express';
import { authGuard } from '../middlewares/auth';
import { uploadSingle } from '../middlewares/upload';
import {
  uploadMedia,
  invalidateMedia,
  destroyMedia,
  getSignedUploadParams,
} from '../controllers/media.controller';

const mediaRoutes = Router();

// GET /media/signed-params — signed upload URL params for direct frontend uploads
mediaRoutes.get('/signed-params', authGuard, getSignedUploadParams);

// POST /api/media/upload - Upload an image to Cloudinary
mediaRoutes.post('/upload', authGuard, uploadSingle, uploadMedia);

// POST /api/media/invalidate - Invalidate CDN cache for a resource
mediaRoutes.post('/invalidate', authGuard, invalidateMedia);

// DELETE /api/media/destroy - Permanently delete a resource from Cloudinary
mediaRoutes.delete('/destroy', authGuard, destroyMedia);

export default mediaRoutes;
