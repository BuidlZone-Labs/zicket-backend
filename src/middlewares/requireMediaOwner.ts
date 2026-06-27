import { RequestHandler } from 'express';
import Media from '../models/media';

/**
 * Middleware: verify the authenticated user owns the media resource
 * before allowing destruction. Prevents IDOR attacks where any
 * authenticated user could delete another user's media.
 */
export const requireMediaOwner: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id || (req as any).user?.sub;
    if (!userId) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }
    const media = await Media.findById(id);
    if (!media) {
      res.status(404).json({ message: 'Media not found' });
      return;
    }
    const owner = media.userId?.toString() || media.uploadedBy?.toString();
    if (owner !== userId.toString()) {
      res.status(403).json({ message: 'Forbidden: you do not own this media' });
      return;
    }
    next();
  } catch (error: any) {
    next(error);
  }
};
