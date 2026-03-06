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

mediaRoutes.get('/signed-params', authGuard, getSignedUploadParams);

mediaRoutes.post('/upload', authGuard, uploadSingle, uploadMedia);

mediaRoutes.post('/invalidate', authGuard, invalidateMedia);

mediaRoutes.delete('/destroy', authGuard, destroyMedia);

export default mediaRoutes;
