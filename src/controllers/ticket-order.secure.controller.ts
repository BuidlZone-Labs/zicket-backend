import { RequestHandler } from 'express';
import TicketOrder from '../models/ticket-order';
import { fail } from '../utils/response';

/**
 * Secure updateTicketOrderStatus.
 * Prevents IDOR by verifying the authenticated user owns the order
 * before allowing any status update.
 */
export const updateTicketOrderStatus: RequestHandler = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    const userId = (req as any).user?.id || (req as any).user?.sub;

    if (!userId) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    // Fetch the order first to verify ownership
    const order = await TicketOrder.findById(orderId);
    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    // IDOR fix: verify the requesting user owns this order
    const orderOwner = order.userId?.toString() || order.user?.toString();
    if (orderOwner !== userId.toString()) {
      res.status(403).json({ message: 'Forbidden: you do not own this order' });
      return;
    }

    const updated = await TicketOrder.findByIdAndUpdate(
      orderId,
      { status },
      { new: true, runValidators: true }
    );

    res.status(200).json({ message: 'Order status updated', order: updated });
  } catch (error: any) {
    next(error);
  }
};
