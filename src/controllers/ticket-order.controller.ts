import { RequestHandler } from 'express';
import { TicketOrderService } from '../services/ticket-order.service';
import { UserAuthenticatedReq } from '../utils/types';

/**
 * Controller for Ticket Orders and Payments transparency
 */
export const getUserOrders: RequestHandler = async (req: UserAuthenticatedReq, res) => {
  try {
    const userId = req.user?._id || (req.user as any)?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User authentication required',
      });
    }

    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;

    const result = await TicketOrderService.getUserOrders(userId.toString(), page, limit);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching user ticket orders:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Failed to fetch user ticket orders',
    });
  }
};

export const getOrganizerOrders: RequestHandler = async (req: UserAuthenticatedReq, res) => {
  try {
    const userId = req.user?._id || (req.user as any)?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User authentication required',
      });
    }

    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;

    // In this context, the logged-in user is viewed as an "Organizer"
    const result = await TicketOrderService.getOrganizerOrders(userId.toString(), page, limit);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching organizer ticket orders:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Failed to fetch organizer ticket orders',
    });
  }
};
