import { RequestHandler } from 'express';
import Message from '../models/message';

/**
 * Middleware: verify the authenticated user is the sender or recipient
 * of a message before allowing read/delete operations.
 * Fixes broken access control where any authenticated user could
 * read or delete any message by ID.
 */
export const requireMessageAccess: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id || (req as any).user?.sub;
    if (!userId) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }
    const message = await Message.findById(id);
    if (!message) {
      res.status(404).json({ message: 'Message not found' });
      return;
    }
    const sender = message.senderId?.toString() || message.from?.toString();
    const recipient = message.recipientId?.toString() || message.to?.toString();
    if (sender !== userId.toString() && recipient !== userId.toString()) {
      res.status(403).json({ message: 'Forbidden: access denied' });
      return;
    }
    next();
  } catch (error: any) {
    next(error);
  }
};
